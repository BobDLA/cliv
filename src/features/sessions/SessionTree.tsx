import { memo, useEffect, useCallback } from "react";
import { Clock, Trash2, FileText, MessageSquare } from "lucide-react";
import { useSessionStore, useAnnotationStore, useDocumentStore } from "@/stores";
import type { SessionSummary } from "@/services/sessionService";

/**
 * SessionTree — left sidebar component showing saved sessions.
 * Displays session history sorted by most recent, with session name,
 * annotation count, and delete action.
 */
export const SessionTree = memo(function SessionTree() {
  const {
    sessions,
    currentSessionId,
    refreshSessions,
    openSession,
    deleteSessionById,
  } = useSessionStore();

  // Load sessions on mount
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const handleOpen = useCallback(
    (id: string) => {
      const session = openSession(id);
      if (session) {
        // Restore annotations into the annotation store
        useAnnotationStore.getState().setAnnotations(session.annotations);
        // Set document path
        if (session.documentPath) {
          useDocumentStore.getState().setDocument({
            composePath: session.documentPath,
          });
        }
      }
    },
    [openSession],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      deleteSessionById(id);
    },
    [deleteSessionById],
  );

  if (sessions.length === 0) {
    return (
      <div
        style={{
          padding: "16px 12px",
          textAlign: "center",
          color: "var(--color-text-faint)",
          fontSize: "12px",
          fontFamily: "var(--font-sans)",
        }}
      >
        <Clock
          style={{
            width: "20px",
            height: "20px",
            margin: "0 auto 8px",
            opacity: 0.5,
          }}
        />
        <p>暂无历史会话</p>
        <p style={{ fontSize: "11px", marginTop: "4px" }}>
          保存批注后会在此处显示
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        padding: "4px",
        fontFamily: "var(--font-sans)",
      }}
    >
      {sessions.map((s) => (
        <SessionItem
          key={s.id}
          session={s}
          isActive={s.id === currentSessionId}
          onOpen={handleOpen}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
});

const SessionItem = memo(function SessionItem({
  session,
  isActive,
  onOpen,
  onDelete,
}: {
  session: SessionSummary;
  isActive: boolean;
  onOpen: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <div
      onClick={() => onOpen(session.id)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        padding: "8px 8px",
        borderRadius: "6px",
        cursor: "pointer",
        transition: "background 0.12s",
        backgroundColor: isActive
          ? "var(--color-surface-hover)"
          : "transparent",
        borderLeft: isActive
          ? "2px solid var(--color-accent)"
          : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!isActive)
          e.currentTarget.style.backgroundColor =
            "var(--color-surface-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isActive)
          e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <FileText
        style={{
          width: "14px",
          height: "14px",
          color: "var(--color-text-faint)",
          marginTop: "2px",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--color-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {session.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "2px",
            fontSize: "11px",
            color: "var(--color-text-faint)",
          }}
        >
          <span
            style={{ display: "flex", alignItems: "center", gap: "3px" }}
          >
            <MessageSquare style={{ width: "10px", height: "10px" }} />
            {session.annotationCount}
          </span>
          <span>{formatTime(session.updatedAt)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => onDelete(e, session.id)}
        title="删除会话"
        style={{
          padding: "2px",
          border: "none",
          backgroundColor: "transparent",
          color: "var(--color-text-faint)",
          cursor: "pointer",
          borderRadius: "4px",
          flexShrink: 0,
          transition: "all 0.12s",
          opacity: 0.5,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.color = "#ef4444";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.5";
          e.currentTarget.style.color = "var(--color-text-faint)";
        }}
      >
        <Trash2 style={{ width: "12px", height: "12px" }} />
      </button>
    </div>
  );
});

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return d.toLocaleDateString("zh-CN");
}
