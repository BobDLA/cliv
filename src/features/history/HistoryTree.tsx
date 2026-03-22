import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Search,
} from "lucide-react";
import { useHistoryStore } from "@/stores";
import type { HistoryWorkspaceGroup } from "@/types";
import { useT } from "@/lib/useT";

export const HistoryTree = memo(function HistoryTree() {
  const {
    groups,
    query,
    isLoading,
    error,
    currentArchiveRef,
    refreshHistory,
    setQuery,
    openArchive,
  } = useHistoryStore();
  const t = useT();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [hoveredGroupKey, setHoveredGroupKey] = useState<string | null>(null);
  const [copiedGroupKey, setCopiedGroupKey] = useState<string | null>(null);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!copiedGroupKey) return;
    const timeoutId = window.setTimeout(() => {
      setCopiedGroupKey((current) =>
        current === copiedGroupKey ? null : current,
      );
    }, 1400);
    return () => window.clearTimeout(timeoutId);
  }, [copiedGroupKey]);

  const filteredGroups = useMemo(
    () => filterGroups(groups, query),
    [groups, query],
  );

  const isFiltering = query.trim().length > 0;
  const hasEntries = filteredGroups.some((group) => group.entries.length > 0);

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }, []);

  const handleCopyPath = useCallback(async (groupKey: string, path: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        return;
      }
      await navigator.clipboard.writeText(path);
      setCopiedGroupKey(groupKey);
    } catch {
      // Ignore clipboard failures in the hover card.
    }
  }, []);

  if (!isLoading && error && groups.length === 0) {
    return (
      <EmptyHistoryState
        title={t("history.loadError")}
        hint={error}
        variant="error"
      />
    );
  }

  if (!isLoading && groups.length === 0) {
    return (
      <EmptyHistoryState
        title={t("history.noHistory")}
        hint={t("history.emptyHint")}
      />
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="history-tree">
      {error ? (
        <div
          className="border-b border-border-subtle/50 bg-kind-challenge-bg/70 px-3 py-2 text-xs text-kind-challenge-text"
          data-testid="history-error-banner"
        >
          {t("history.loadError")}: {error}
        </div>
      ) : null}
      <div
        className="border-b border-border-subtle/50"
        style={{ padding: "8px" }}
      >
        <label className="relative block">
          <Search
            className="pointer-events-none absolute text-text-subtle"
            style={{
              left: "10px",
              top: "50%",
              width: "14px",
              height: "14px",
              transform: "translateY(-50%)",
            }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("history.searchPlaceholder")}
            className="w-full border border-border-subtle/70 bg-surface-panel text-sm text-text-primary outline-none transition-colors placeholder:text-text-subtle focus:border-accent/60"
            style={{
              borderRadius: "6px",
              padding: "8px 12px 8px 32px",
              lineHeight: 1.25,
            }}
            data-testid="history-search-input"
          />
        </label>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{ padding: "12px 8px" }}
      >
        {hasEntries ? (
          filteredGroups.map((group) => {
            const isExpanded = isFiltering || !collapsedGroups[group.key];

            return (
              <section
                key={group.key}
                style={{ marginBottom: "12px" }}
                data-testid="history-group"
              >
                <div
                  className="border border-border-subtle/55 bg-surface-panel/80 shadow-[0_10px_28px_rgba(15,23,42,0.05)]"
                  style={{ borderRadius: "8px", padding: "6px" }}
                >
                  <div
                    className="relative min-w-0"
                    onMouseEnter={() => setHoveredGroupKey(group.key)}
                    onMouseLeave={() =>
                      setHoveredGroupKey((current) =>
                        current === group.key ? null : current,
                      )
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className="w-full text-left transition-colors hover:bg-surface-hover/80"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        borderRadius: "7px",
                        padding: "8px 10px",
                      }}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? t("history.collapseGroup") : t("history.expandGroup")}: ${group.label}`}
                      data-testid="history-group-toggle"
                    >
                      <span
                        className="shrink-0 text-text-subtle"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "14px",
                          height: "14px",
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
                      <div
                        className="min-w-0"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          minWidth: 0,
                          flex: 1,
                        }}
                        data-testid="history-group-label"
                        title={group.path}
                      >
                        <div
                          className="truncate text-text-primary"
                          style={{
                            fontSize: "0.93rem",
                            fontWeight: 600,
                            lineHeight: 1.2,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          {group.label}
                        </div>
                        <div
                          className="shrink-0 text-text-subtle"
                          style={{
                            display: "inline-flex",
                            justifyContent: "flex-end",
                            fontSize: "0.74rem",
                            fontWeight: 500,
                            lineHeight: 1,
                            minWidth: "2.6rem",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                          }}
                          data-testid="history-group-count"
                        >
                          {t("history.groupCount", group.entries.length)}
                        </div>
                      </div>
                    </button>

                    {hoveredGroupKey === group.key ? (
                      <div
                        className="border-t border-border-subtle/60"
                        style={{ marginTop: "4px", padding: "10px 10px 8px" }}
                        data-testid="history-group-path-popover"
                      >
                        <div
                          className="text-text-subtle uppercase"
                          style={{
                            fontSize: "0.64rem",
                            fontWeight: 600,
                            letterSpacing: "0.14em",
                          }}
                        >
                          {t("history.pathLabel")}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginTop: "6px",
                          }}
                        >
                          <div
                            className="text-text-primary"
                            style={{
                              minWidth: 0,
                              flex: 1,
                              fontSize: "0.74rem",
                              lineHeight: 1.35,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={group.path}
                          >
                            {group.path}
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleCopyPath(group.key, group.path)}
                            className="border border-border-subtle/70 bg-surface-app/80 text-text-subtle transition-colors hover:border-accent/30 hover:bg-surface-hover hover:text-text-primary"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              flexShrink: 0,
                              borderRadius: "6px",
                              padding: "6px 8px",
                              fontSize: "0.72rem",
                              fontWeight: 500,
                            }}
                            data-testid="history-group-copy-path"
                          >
                            {copiedGroupKey === group.key ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            {copiedGroupKey === group.key
                              ? t("history.pathCopied")
                              : t("history.copyPath")}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {isExpanded ? (
                  <div
                    className="relative"
                    style={{
                      marginTop: "8px",
                      marginLeft: "22px",
                      paddingLeft: "20px",
                    }}
                    data-testid="history-group-children"
                  >
                    <div
                      aria-hidden="true"
                      className="bg-border-subtle/80"
                      style={{
                        position: "absolute",
                        left: "5px",
                        top: "0px",
                        bottom: "8px",
                        width: "1px",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      {group.entries.map((entry) => {
                        const isActive =
                          currentArchiveRef?.workspaceKey === entry.workspaceKey &&
                          currentArchiveRef.archiveId === entry.id;
                        const summary = formatSummary(
                          entry.archivedAt,
                          entry.submittedChars,
                          entry.itemCount,
                          t,
                        );

                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => void openArchive(entry.workspaceKey, entry.id)}
                            className={`group relative block w-full text-left transition-colors ${
                              isActive ? "" : "hover:bg-surface-hover/70"
                            }`}
                            style={{
                              borderRadius: "6px",
                              padding: "8px 10px 8px 14px",
                              backgroundColor: isActive
                                ? "var(--color-accent-glow)"
                                : "transparent",
                            }}
                            title={summary}
                            data-testid="history-entry"
                            data-archive-id={entry.id}
                          >
                            <span
                              aria-hidden="true"
                              className="bg-border-subtle/80"
                              style={{
                                position: "absolute",
                                left: "-14px",
                                top: "50%",
                                width: "14px",
                                height: "1px",
                                transform: "translateY(-50%)",
                              }}
                            />
                            <div
                              className={`min-w-0 tabular-nums ${
                                isActive
                                  ? "font-medium text-text-primary"
                                  : "font-normal text-text-muted"
                              }`}
                              style={{
                                fontSize: "0.82rem",
                                lineHeight: 1.45,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {summary}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })
        ) : (
          <EmptyHistoryState
            title={t("history.noMatch")}
            hint={t("history.noMatchHint")}
          />
        )}
      </div>
    </div>
  );
});

function EmptyHistoryState({
  title,
  hint,
  variant = "empty",
}: {
  title: string;
  hint: string;
  variant?: "empty" | "error";
}) {
  return (
    <div
      style={{
        padding: "16px 12px",
        textAlign: "center",
        color: "var(--color-text-faint)",
        fontSize: "0.85rem",
        fontFamily: "var(--font-sans)",
      }}
      data-testid={variant === "error" ? "history-tree-error" : "history-tree-empty"}
    >
      {variant === "error" ? (
        <AlertCircle
          style={{
            width: "20px",
            height: "20px",
            margin: "0 auto 8px",
            opacity: 0.7,
          }}
        />
      ) : (
        <Clock
          style={{
            width: "20px",
            height: "20px",
            margin: "0 auto 8px",
            opacity: 0.5,
          }}
        />
      )}
      <p>{title}</p>
      <p style={{ fontSize: "0.8rem", marginTop: "4px" }}>{hint}</p>
    </div>
  );
}

function filterGroups(
  groups: HistoryWorkspaceGroup[],
  query: string,
): HistoryWorkspaceGroup[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return groups;

  return groups
    .map((group) => {
      const groupMatches =
        group.label.toLowerCase().includes(normalizedQuery) ||
        group.path.toLowerCase().includes(normalizedQuery);

      return {
        ...group,
        entries: groupMatches
          ? group.entries
          : group.entries.filter((entry) =>
              entry.searchText.toLowerCase().includes(normalizedQuery),
            ),
      };
    })
    .filter((group) => group.entries.length > 0);
}

function formatSummary(
  archivedAt: string,
  submittedChars: number,
  itemCount: number,
  t: (key: string, n?: number | string) => string,
): string {
  const date = new Date(archivedAt);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${min} · ${submittedChars}${t("history.charsSuffix")} · ${itemCount}${t("history.itemsSuffix")}`;
}
