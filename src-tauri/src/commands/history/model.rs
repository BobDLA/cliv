use serde::{Deserialize, Serialize};

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
pub(super) struct WorkspaceRecord {
    pub key: String,
    pub label: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(super) struct ArchiveMeta {
    pub id: String,
    pub archived_at: String,
    pub agent: Option<String>,
    pub workspace_key: String,
    pub workspace_path: String,
    pub review_path: Option<String>,
    pub reply_path: Option<String>,
    pub target_path: Option<String>,
    pub submitted_chars: usize,
    pub item_count: usize,
    pub preview: String,
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

pub(super) fn first_non_empty_line(text: &str) -> String {
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

pub(super) fn build_history_entry_summary(
    workspace_record: &WorkspaceRecord,
    meta: &ArchiveMeta,
    annotations: &[ArchiveAnnotation],
) -> HistoryEntrySummary {
    HistoryEntrySummary {
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
            meta,
            annotations,
        ),
    }
}
