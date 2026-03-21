import { memo, useEffect, useMemo } from "react";
import { Clock, Search } from "lucide-react";
import { useHistoryStore } from "@/stores";
import type { HistoryWorkspaceGroup } from "@/types";
import { useT } from "@/lib/useT";

export const HistoryTree = memo(function HistoryTree() {
  const {
    groups,
    query,
    isLoading,
    currentArchiveRef,
    refreshHistory,
    setQuery,
    openArchive,
  } = useHistoryStore();
  const t = useT();

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const filteredGroups = useMemo(
    () => filterGroups(groups, query),
    [groups, query],
  );

  const hasEntries = filteredGroups.some((group) => group.entries.length > 0);

  if (!isLoading && groups.length === 0) {
    return (
      <EmptyHistoryState
        title={t("history.noHistory")}
        hint={t("history.emptyHint")}
      />
    );
  }

  return (
    <div
      className="flex h-full flex-col"
      data-testid="history-tree"
    >
      <div className="border-b border-border-subtle/50 p-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("history.searchPlaceholder")}
            className="w-full rounded-md border border-border-subtle/70 bg-surface-panel py-1.5 pl-8 pr-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-subtle focus:border-accent/60"
            data-testid="history-search-input"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-1 py-2">
        {hasEntries ? (
          filteredGroups.map((group) => (
            <section key={group.key} className="mb-4" data-testid="history-group">
              <div className="px-2 pb-1">
                <div className="truncate text-sm font-semibold text-text-primary">
                  {group.label}
                </div>
                <div className="truncate text-[0.75rem] text-text-subtle">
                  {group.path}
                </div>
              </div>

              <div className="space-y-1">
                {group.entries.map((entry) => {
                  const isActive =
                    currentArchiveRef?.workspaceKey === entry.workspaceKey &&
                    currentArchiveRef.archiveId === entry.id;

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => void openArchive(entry.workspaceKey, entry.id)}
                      className={`block w-full rounded-md border-l-2 px-3 py-2 text-left transition-colors ${
                        isActive
                          ? "border-accent bg-surface-hover"
                          : "border-transparent hover:bg-surface-hover"
                      }`}
                      data-testid="history-entry"
                      data-archive-id={entry.id}
                    >
                      <div className="text-sm font-medium text-text-primary">
                        {formatSummary(entry.archivedAt, entry.submittedChars, entry.itemCount, t)}
                      </div>
                      {entry.preview ? (
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-text-subtle">
                          {entry.preview}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
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
}: {
  title: string;
  hint: string;
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
      data-testid="history-tree-empty"
    >
      <Clock
        style={{
          width: "20px",
          height: "20px",
          margin: "0 auto 8px",
          opacity: 0.5,
        }}
      />
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
