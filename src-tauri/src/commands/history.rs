use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

fn get_data_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".cliv")
}

fn history_dir() -> PathBuf {
    get_data_dir().join("history").join("archive")
}

fn tmp_path(target: &PathBuf) -> PathBuf {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    target.with_extension(format!("tmp.{}", timestamp))
}

fn atomic_write(path: &PathBuf, data: &str) -> Result<(), String> {
    let tmp = tmp_path(path);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create history dir: {}", e))?;
    }

    fs::write(&tmp, data).map_err(|e| format!("Failed to write: {}", e))?;

    if let Err(e) = fs::rename(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Failed to save: {}", e));
    }

    Ok(())
}

fn workspace_key(path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("ws_{:016x}", hasher.finish())
}

fn workspace_label(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .map(|name| name.to_string())
        .unwrap_or_else(|| path.to_string())
}

fn archive_id() -> String {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("arch_{}", timestamp)
}

fn first_non_empty_line(text: &str) -> String {
    text.lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(truncate_preview)
        .unwrap_or_default()
}

fn truncate_preview(text: &str) -> String {
    const MAX_CHARS: usize = 80;
    let mut chars = text.chars();
    let preview: String = chars.by_ref().take(MAX_CHARS).collect();
    if chars.next().is_some() {
        format!("{}…", preview)
    } else {
        preview
    }
}

fn search_blob(
    workspace_path: &str,
    workspace_label: &str,
    meta: &ArchiveMeta,
    annotations: &[ArchiveAnnotation],
) -> String {
    let mut parts = vec![
        workspace_label.to_string(),
        workspace_path.to_string(),
        meta.preview.clone(),
    ];

    if let Some(path) = &meta.review_path {
        parts.push(path.clone());
    }
    if let Some(path) = &meta.reply_path {
        parts.push(path.clone());
    }
    if let Some(path) = &meta.target_path {
        parts.push(path.clone());
    }

    for annotation in annotations {
        parts.push(annotation.quote.clone());
        parts.push(annotation.comment.clone());
    }

    parts.join("\n").to_lowercase()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AnnotationRange {
    pub start_offset: usize,
    pub end_offset: usize,
    pub paragraph_index: Option<usize>,
    pub context_snippet: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveAnnotation {
    pub id: String,
    pub document_id: String,
    pub quote: String,
    pub comment: String,
    pub range: Option<AnnotationRange>,
    pub kind: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SubmissionRecord {
    pub created_at: String,
    pub method: String,
    pub template_mode: String,
    pub user_text: String,
    pub final_output: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveReviewArchiveInput {
    pub workspace_path: String,
    pub agent: Option<String>,
    pub review_path: Option<String>,
    pub reply_path: Option<String>,
    pub target_path: Option<String>,
    pub reply_content: String,
    pub annotations: Vec<ArchiveAnnotation>,
    pub submission: SubmissionRecord,
    pub target_before: Option<String>,
    pub item_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorkspaceRecord {
    key: String,
    label: String,
    path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ArchiveMeta {
    id: String,
    archived_at: String,
    agent: Option<String>,
    workspace_key: String,
    workspace_path: String,
    review_path: Option<String>,
    reply_path: Option<String>,
    target_path: Option<String>,
    submitted_chars: usize,
    item_count: usize,
    preview: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntrySummary {
    pub id: String,
    pub workspace_key: String,
    pub workspace_label: String,
    pub workspace_path: String,
    pub archived_at: String,
    pub agent: Option<String>,
    pub review_path: Option<String>,
    pub reply_path: Option<String>,
    pub target_path: Option<String>,
    pub submitted_chars: usize,
    pub item_count: usize,
    pub preview: String,
    pub search_text: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryWorkspaceGroup {
    pub key: String,
    pub label: String,
    pub path: String,
    pub entries: Vec<HistoryEntrySummary>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReviewArchiveData {
    pub summary: HistoryEntrySummary,
    pub reply_content: String,
    pub annotations: Vec<ArchiveAnnotation>,
    pub submission: Option<SubmissionRecord>,
    pub target_before: Option<String>,
}

fn save_review_archive_to(
    root: &Path,
    input: SaveReviewArchiveInput,
) -> Result<HistoryEntrySummary, String> {
    if input.workspace_path.trim().is_empty() {
        return Err("workspace_path cannot be empty".to_string());
    }

    let workspace_key = workspace_key(&input.workspace_path);
    let workspace_label = workspace_label(&input.workspace_path);
    let workspace_root = root.join(&workspace_key);
    let workspace_record = WorkspaceRecord {
        key: workspace_key.clone(),
        label: workspace_label.clone(),
        path: input.workspace_path.clone(),
    };
    let workspace_json = serde_json::to_string_pretty(&workspace_record)
        .map_err(|e| format!("Failed to encode workspace metadata: {}", e))?;
    atomic_write(&workspace_root.join("workspace.json"), &workspace_json)?;

    let archived_at = input.submission.created_at.clone();
    let year = archived_at.get(0..4).unwrap_or("unknown");
    let month = archived_at.get(5..7).unwrap_or("unknown");
    let archive_dir = workspace_root
        .join(year)
        .join(month)
        .join(archive_id());

    fs::create_dir_all(&archive_dir)
        .map_err(|e| format!("Failed to create archive dir: {}", e))?;

    let preview = first_non_empty_line(&input.submission.final_output);
    let item_count = input.item_count.max(input.annotations.len());
    let meta = ArchiveMeta {
        id: archive_dir
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string(),
        archived_at: archived_at.clone(),
        agent: input.agent.clone(),
        workspace_key: workspace_key.clone(),
        workspace_path: input.workspace_path.clone(),
        review_path: input.review_path.clone(),
        reply_path: input.reply_path.clone(),
        target_path: input.target_path.clone(),
        submitted_chars: input.submission.final_output.chars().count(),
        item_count,
        preview,
    };

    let meta_json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to encode archive metadata: {}", e))?;
    atomic_write(&archive_dir.join("meta.json"), &meta_json)?;
    atomic_write(&archive_dir.join("reply.md"), &input.reply_content)?;

    let annotations_json = serde_json::to_string_pretty(&input.annotations)
        .map_err(|e| format!("Failed to encode annotations: {}", e))?;
    atomic_write(&archive_dir.join("annotations.json"), &annotations_json)?;

    let submission_json = serde_json::to_string_pretty(&input.submission)
        .map_err(|e| format!("Failed to encode submission: {}", e))?;
    atomic_write(&archive_dir.join("submission.json"), &submission_json)?;

    if let Some(target_before) = input.target_before {
        atomic_write(&archive_dir.join("target.before.md"), &target_before)?;
    }

    let search_text = search_blob(
        &input.workspace_path,
        &workspace_label,
        &meta,
        &input.annotations,
    );

    Ok(HistoryEntrySummary {
        id: meta.id.clone(),
        workspace_key,
        workspace_label: workspace_label.clone(),
        workspace_path: input.workspace_path.clone(),
        archived_at,
        agent: input.agent,
        review_path: input.review_path,
        reply_path: input.reply_path,
        target_path: input.target_path,
        submitted_chars: meta.submitted_chars,
        item_count: meta.item_count,
        preview: meta.preview,
        search_text,
    })
}

fn list_review_history_from(root: &Path) -> Result<Vec<HistoryWorkspaceGroup>, String> {
    let mut groups = Vec::new();

    if !root.exists() {
        return Ok(groups);
    }

    for entry in fs::read_dir(root).map_err(|e| format!("Failed to read history root: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read history entry: {}", e))?;
        if !entry.path().is_dir() {
            continue;
        }

        let workspace_json = entry.path().join("workspace.json");
        if !workspace_json.exists() {
            continue;
        }

        let workspace_record: WorkspaceRecord = serde_json::from_str(
            &fs::read_to_string(&workspace_json)
                .map_err(|e| format!("Failed to read workspace metadata: {}", e))?,
        )
        .map_err(|e| format!("Failed to parse workspace metadata: {}", e))?;

        let mut summaries = Vec::new();
        collect_archive_summaries(&entry.path(), &workspace_record, &mut summaries)?;
        summaries.sort_by(|a, b| b.archived_at.cmp(&a.archived_at));

        groups.push(HistoryWorkspaceGroup {
            key: workspace_record.key,
            label: workspace_record.label,
            path: workspace_record.path,
            entries: summaries,
        });
    }

    groups.sort_by(|a, b| {
        let a_latest = a.entries.first().map(|entry| entry.archived_at.as_str()).unwrap_or("");
        let b_latest = b.entries.first().map(|entry| entry.archived_at.as_str()).unwrap_or("");
        b_latest.cmp(a_latest)
    });

    Ok(groups)
}

fn collect_archive_summaries(
    workspace_root: &Path,
    workspace_record: &WorkspaceRecord,
    summaries: &mut Vec<HistoryEntrySummary>,
) -> Result<(), String> {
    for year_entry in fs::read_dir(workspace_root)
        .map_err(|e| format!("Failed to read workspace archives: {}", e))?
    {
        let year_entry =
            year_entry.map_err(|e| format!("Failed to read year archive entry: {}", e))?;
        let year_path = year_entry.path();
        if !year_path.is_dir()
            || year_path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| !name.chars().all(|ch| ch.is_ascii_digit()))
                .unwrap_or(true)
        {
            continue;
        }

        for month_entry in fs::read_dir(&year_path)
            .map_err(|e| format!("Failed to read month archive entry: {}", e))?
        {
            let month_entry =
                month_entry.map_err(|e| format!("Failed to read month archive item: {}", e))?;
            let month_path = month_entry.path();
            if !month_path.is_dir() {
                continue;
            }

            for archive_entry in fs::read_dir(&month_path)
                .map_err(|e| format!("Failed to read archive item: {}", e))?
            {
                let archive_entry =
                    archive_entry.map_err(|e| format!("Failed to read archive dir: {}", e))?;
                let archive_path = archive_entry.path();
                if !archive_path.is_dir() {
                    continue;
                }

                let meta_path = archive_path.join("meta.json");
                if !meta_path.exists() {
                    continue;
                }

                let meta: ArchiveMeta = serde_json::from_str(
                    &fs::read_to_string(&meta_path)
                        .map_err(|e| format!("Failed to read archive metadata: {}", e))?,
                )
                .map_err(|e| format!("Failed to parse archive metadata: {}", e))?;

                let annotations_path = archive_path.join("annotations.json");
                let annotations: Vec<ArchiveAnnotation> = if annotations_path.exists() {
                    serde_json::from_str(
                        &fs::read_to_string(&annotations_path)
                            .map_err(|e| format!("Failed to read archive annotations: {}", e))?,
                    )
                    .map_err(|e| format!("Failed to parse archive annotations: {}", e))?
                } else {
                    Vec::new()
                };

                summaries.push(HistoryEntrySummary {
                    id: meta.id.clone(),
                    workspace_key: workspace_record.key.clone(),
                    workspace_label: workspace_record.label.clone(),
                    workspace_path: workspace_record.path.clone(),
                    archived_at: meta.archived_at.clone(),
                    agent: meta.agent.clone(),
                    review_path: meta.review_path.clone(),
                    reply_path: meta.reply_path.clone(),
                    target_path: meta.target_path.clone(),
                    submitted_chars: meta.submitted_chars,
                    item_count: meta.item_count,
                    preview: meta.preview.clone(),
                    search_text: search_blob(
                        &workspace_record.path,
                        &workspace_record.label,
                        &meta,
                        &annotations,
                    ),
                });
            }
        }
    }

    Ok(())
}

fn load_review_archive_from(
    root: &Path,
    workspace_key: &str,
    archive_id: &str,
) -> Result<ReviewArchiveData, String> {
    let workspace_root = root.join(workspace_key);
    let workspace_json = workspace_root.join("workspace.json");
    let workspace_record: WorkspaceRecord = serde_json::from_str(
        &fs::read_to_string(&workspace_json)
            .map_err(|e| format!("Failed to read workspace metadata: {}", e))?,
    )
    .map_err(|e| format!("Failed to parse workspace metadata: {}", e))?;

    let mut found_dir: Option<PathBuf> = None;
    'outer: for year_entry in fs::read_dir(&workspace_root)
        .map_err(|e| format!("Failed to read workspace archives: {}", e))?
    {
        let year_entry =
            year_entry.map_err(|e| format!("Failed to read workspace archive entry: {}", e))?;
        let year_path = year_entry.path();
        if !year_path.is_dir() {
            continue;
        }
        for month_entry in fs::read_dir(&year_path)
            .map_err(|e| format!("Failed to read workspace archive month: {}", e))?
        {
            let month_entry =
                month_entry.map_err(|e| format!("Failed to read workspace archive month: {}", e))?;
            let month_path = month_entry.path();
            if !month_path.is_dir() {
                continue;
            }
            let candidate = month_path.join(archive_id);
            if candidate.is_dir() {
                found_dir = Some(candidate);
                break 'outer;
            }
        }
    }

    let archive_dir = found_dir.ok_or_else(|| format!("Archive '{}' not found", archive_id))?;

    let meta: ArchiveMeta = serde_json::from_str(
        &fs::read_to_string(archive_dir.join("meta.json"))
            .map_err(|e| format!("Failed to read archive metadata: {}", e))?,
    )
    .map_err(|e| format!("Failed to parse archive metadata: {}", e))?;
    let reply_content = fs::read_to_string(archive_dir.join("reply.md"))
        .map_err(|e| format!("Failed to read archive reply: {}", e))?;
    let annotations: Vec<ArchiveAnnotation> = serde_json::from_str(
        &fs::read_to_string(archive_dir.join("annotations.json"))
            .map_err(|e| format!("Failed to read archive annotations: {}", e))?,
    )
    .map_err(|e| format!("Failed to parse archive annotations: {}", e))?;

    let submission_path = archive_dir.join("submission.json");
    let submission = if submission_path.exists() {
        Some(
            serde_json::from_str(
                &fs::read_to_string(&submission_path)
                    .map_err(|e| format!("Failed to read archive submission: {}", e))?,
            )
            .map_err(|e| format!("Failed to parse archive submission: {}", e))?,
        )
    } else {
        None
    };

    let target_before_path = archive_dir.join("target.before.md");
    let target_before = if target_before_path.exists() {
        Some(
            fs::read_to_string(&target_before_path)
                .map_err(|e| format!("Failed to read target.before.md: {}", e))?,
        )
    } else {
        None
    };

    let search_text = search_blob(
        &workspace_record.path,
        &workspace_record.label,
        &meta,
        &annotations,
    );

    let summary = HistoryEntrySummary {
        id: meta.id.clone(),
        workspace_key: workspace_record.key,
        workspace_label: workspace_record.label.clone(),
        workspace_path: workspace_record.path.clone(),
        archived_at: meta.archived_at,
        agent: meta.agent,
        review_path: meta.review_path,
        reply_path: meta.reply_path,
        target_path: meta.target_path,
        submitted_chars: meta.submitted_chars,
        item_count: meta.item_count,
        preview: meta.preview,
        search_text,
    };

    Ok(ReviewArchiveData {
        summary,
        reply_content,
        annotations,
        submission,
        target_before,
    })
}

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
    use super::{
        load_review_archive_from, list_review_history_from, save_review_archive_to, AnnotationRange,
        ArchiveAnnotation, SaveReviewArchiveInput, SubmissionRecord,
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
}
