use super::model::{
    build_history_entry_summary, first_non_empty_line, ArchiveAnnotation, ArchiveMeta,
    HistoryEntrySummary, HistoryWorkspaceGroup, ReviewArchiveData, SaveReviewArchiveInput,
    SubmissionRecord, WorkspaceRecord,
};
use super::paths::{archive_id, workspace_key, workspace_label};
use super::storage::{atomic_write, is_ascii_digit_dir, read_json, read_optional_json, read_string, write_json};
use std::fs;
use std::path::{Path, PathBuf};

pub(super) fn save_review_archive_to(
    root: &Path,
    input: SaveReviewArchiveInput,
) -> Result<HistoryEntrySummary, String> {
    if input.workspace_path.trim().is_empty() {
        return Err("workspace_path cannot be empty".to_string());
    }

    let SaveReviewArchiveInput {
        workspace_path,
        agent,
        review_path,
        reply_path,
        target_path,
        reply_content,
        annotations,
        submission,
        target_before,
        item_count,
    } = input;

    let workspace_record = WorkspaceRecord {
        key: workspace_key(&workspace_path),
        label: workspace_label(&workspace_path),
        path: workspace_path.clone(),
    };
    let workspace_root = root.join(&workspace_record.key);
    write_json(
        &workspace_root.join("workspace.json"),
        &workspace_record,
        "workspace metadata",
    )?;

    let archived_at = submission.created_at.clone();
    let archive_dir = workspace_root
        .join(archived_at.get(0..4).unwrap_or("unknown"))
        .join(archived_at.get(5..7).unwrap_or("unknown"))
        .join(archive_id());

    fs::create_dir_all(&archive_dir)
        .map_err(|e| format!("Failed to create archive dir: {}", e))?;

    let item_count = item_count.max(annotations.len());
    let meta = ArchiveMeta {
        id: archive_dir
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string(),
        archived_at,
        agent,
        workspace_key: workspace_record.key.clone(),
        workspace_path: workspace_path.clone(),
        review_path,
        reply_path,
        target_path,
        submitted_chars: submission.final_output.chars().count(),
        item_count,
        preview: first_non_empty_line(&submission.final_output),
    };

    write_json(&archive_dir.join("meta.json"), &meta, "archive metadata")?;
    atomic_write(&archive_dir.join("reply.md"), &reply_content)?;
    write_json(
        &archive_dir.join("annotations.json"),
        &annotations,
        "annotations",
    )?;
    write_json(
        &archive_dir.join("submission.json"),
        &submission,
        "submission",
    )?;

    if let Some(previous_target) = target_before {
        atomic_write(&archive_dir.join("target.before.md"), &previous_target)?;
    }

    Ok(build_history_entry_summary(
        &workspace_record,
        &meta,
        &annotations,
    ))
}

pub(super) fn list_review_history_from(root: &Path) -> Result<Vec<HistoryWorkspaceGroup>, String> {
    let mut groups = Vec::new();
    if !root.exists() {
        return Ok(groups);
    }

    for entry in
        fs::read_dir(root).map_err(|e| format!("Failed to read history root: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read history entry: {}", e))?;
        if !entry.path().is_dir() {
            continue;
        }

        let workspace_json = entry.path().join("workspace.json");
        if !workspace_json.exists() {
            continue;
        }

        let workspace_record: WorkspaceRecord =
            read_json(&workspace_json, "workspace metadata")?;
        let mut entries = collect_archive_summaries(&entry.path(), &workspace_record)?;
        entries.sort_by(|left, right| right.archived_at.cmp(&left.archived_at));

        groups.push(HistoryWorkspaceGroup {
            key: workspace_record.key,
            label: workspace_record.label,
            path: workspace_record.path,
            entries,
        });
    }

    groups.sort_by(|left, right| {
        let left_latest = left
            .entries
            .first()
            .map(|entry| entry.archived_at.as_str())
            .unwrap_or("");
        let right_latest = right
            .entries
            .first()
            .map(|entry| entry.archived_at.as_str())
            .unwrap_or("");
        right_latest.cmp(left_latest)
    });

    Ok(groups)
}

pub(super) fn load_review_archive_from(
    root: &Path,
    workspace_key: &str,
    archive_id: &str,
) -> Result<ReviewArchiveData, String> {
    let workspace_root = root.join(workspace_key);
    let workspace_record: WorkspaceRecord = read_json(
        &workspace_root.join("workspace.json"),
        "workspace metadata",
    )?;
    let archive_dir = find_archive_dir(&workspace_root, archive_id)?
        .ok_or_else(|| format!("Archive '{}' not found", archive_id))?;

    let meta: ArchiveMeta = read_json(&archive_dir.join("meta.json"), "archive metadata")?;
    let reply_content = read_string(&archive_dir.join("reply.md"), "archive reply")?;
    let annotations: Vec<ArchiveAnnotation> = read_json(
        &archive_dir.join("annotations.json"),
        "archive annotations",
    )?;
    let submission: Option<SubmissionRecord> = read_optional_json(
        &archive_dir.join("submission.json"),
        "archive submission",
    )?;
    let target_before = if archive_dir.join("target.before.md").exists() {
        Some(read_string(
            &archive_dir.join("target.before.md"),
            "target.before.md",
        )?)
    } else {
        None
    };

    Ok(ReviewArchiveData {
        summary: build_history_entry_summary(&workspace_record, &meta, &annotations),
        reply_content,
        annotations,
        submission,
        target_before,
    })
}

fn collect_archive_summaries(
    workspace_root: &Path,
    workspace_record: &WorkspaceRecord,
) -> Result<Vec<HistoryEntrySummary>, String> {
    let mut summaries = Vec::new();

    for year_entry in fs::read_dir(workspace_root)
        .map_err(|e| format!("Failed to read workspace archives: {}", e))?
    {
        let year_entry =
            year_entry.map_err(|e| format!("Failed to read year archive entry: {}", e))?;
        let year_path = year_entry.path();
        if !is_ascii_digit_dir(&year_path) {
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

                let meta: ArchiveMeta = read_json(&meta_path, "archive metadata")?;
                let annotations: Vec<ArchiveAnnotation> = read_optional_json(
                    &archive_path.join("annotations.json"),
                    "archive annotations",
                )?
                .unwrap_or_default();

                summaries.push(build_history_entry_summary(
                    workspace_record,
                    &meta,
                    &annotations,
                ));
            }
        }
    }

    Ok(summaries)
}

fn find_archive_dir(workspace_root: &Path, archive_id: &str) -> Result<Option<PathBuf>, String> {
    for year_entry in fs::read_dir(workspace_root)
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
            let month_entry = month_entry
                .map_err(|e| format!("Failed to read workspace archive month: {}", e))?;
            let month_path = month_entry.path();
            if !month_path.is_dir() {
                continue;
            }

            let candidate = month_path.join(archive_id);
            if candidate.is_dir() {
                return Ok(Some(candidate));
            }
        }
    }

    Ok(None)
}
