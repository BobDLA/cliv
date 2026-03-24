mod model;
mod paths;
mod service;
mod storage;

pub use model::{
    HistoryEntrySummary, HistoryWorkspaceGroup, ReviewArchiveData, SaveReviewArchiveInput,
};

use paths::history_dir;
use service::{load_review_archive_from, list_review_history_from, save_review_archive_to};

#[tauri::command]
pub fn save_review_archive(input: SaveReviewArchiveInput) -> Result<HistoryEntrySummary, String> {
    save_review_archive_to(&history_dir(), input)
}

#[tauri::command]
pub fn list_review_history() -> Result<Vec<HistoryWorkspaceGroup>, String> {
    list_review_history_from(&history_dir())
}

#[tauri::command]
pub fn load_review_archive(
    workspace_key: String,
    archive_id: String,
) -> Result<ReviewArchiveData, String> {
    load_review_archive_from(&history_dir(), &workspace_key, &archive_id)
}

#[cfg(test)]
mod tests {
    use super::model::{
        AnnotationRange, ArchiveAnnotation, SaveReviewArchiveInput, SubmissionRecord,
    };
    use super::service::{
        load_review_archive_from, list_review_history_from, save_review_archive_to,
    };

    #[test]
    fn save_list_and_load_review_archive() {
        let dir = tempfile::tempdir().unwrap();
        let input = SaveReviewArchiveInput {
            workspace_path: "/tmp/example/project".to_string(),
            agent: Some("codex".to_string()),
            review_path: Some("/tmp/example/project/reply.md".to_string()),
            reply_path: Some("/tmp/example/project/reply.md".to_string()),
            target_path: Some("/tmp/example/project/compose.md".to_string()),
            reply_content: "# reply\n\nbody".to_string(),
            annotations: vec![ArchiveAnnotation {
                id: "ann-1".to_string(),
                document_id: "doc-1".to_string(),
                quote: "body".to_string(),
                comment: "Need more detail".to_string(),
                range: Some(AnnotationRange {
                    start_offset: 8,
                    end_offset: 12,
                    paragraph_index: None,
                    context_snippet: Some("body".to_string()),
                }),
                kind: "comment".to_string(),
                status: "open".to_string(),
                created_at: "2026-03-22T10:00:00.000Z".to_string(),
            }],
            submission: SubmissionRecord {
                created_at: "2026-03-22T10:01:00.000Z".to_string(),
                method: "written".to_string(),
                template_mode: "reply".to_string(),
                user_text: "Header".to_string(),
                final_output: "Header\n\nReview feedback".to_string(),
            },
            target_before: Some("old draft".to_string()),
            item_count: 2,
        };

        let saved = save_review_archive_to(dir.path(), input).unwrap();
        let groups = list_review_history_from(dir.path()).unwrap();

        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].path, "/tmp/example/project");
        assert_eq!(groups[0].entries.len(), 1);
        assert_eq!(groups[0].entries[0].submitted_chars, 23);
        assert_eq!(groups[0].entries[0].item_count, 2);
        assert!(groups[0].entries[0]
            .search_text
            .contains("need more detail"));

        let loaded =
            load_review_archive_from(dir.path(), &saved.workspace_key, &saved.id).unwrap();
        assert_eq!(loaded.reply_content, "# reply\n\nbody");
        assert_eq!(loaded.annotations.len(), 1);
        assert_eq!(
            loaded.submission.as_ref().map(|record| record.method.as_str()),
            Some("written")
        );
        assert_eq!(loaded.target_before.as_deref(), Some("old draft"));
    }

    #[test]
    fn rejects_empty_workspace_path() {
        let dir = tempfile::tempdir().unwrap();
        let input = SaveReviewArchiveInput {
            workspace_path: "   ".to_string(),
            agent: None,
            review_path: None,
            reply_path: None,
            target_path: None,
            reply_content: "# reply".to_string(),
            annotations: Vec::new(),
            submission: SubmissionRecord {
                created_at: "2026-03-22T10:01:00.000Z".to_string(),
                method: "clipboard".to_string(),
                template_mode: "reply".to_string(),
                user_text: "Header".to_string(),
                final_output: "Header".to_string(),
            },
            target_before: None,
            item_count: 1,
        };

        let error = save_review_archive_to(dir.path(), input).unwrap_err();
        assert_eq!(error, "workspace_path cannot be empty");
    }
}
