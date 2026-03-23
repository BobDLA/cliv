import { useEffect, useState } from "react";
import { ThemeSwitcher } from "@/features/documents/ThemeSwitcher";
import { DEFAULT_SHORTCUTS, normalizeShortcut } from "@/lib/shortcuts";
import { resolvePromptHeader } from "@/lib/promptTemplates";
import { useConfigStore, useUIStore } from "@/stores";
import type {
  ContentWidth,
  HighlightStrength,
  PagePadding,
  PromptConfig,
  ReadingDensity,
  ShortcutCommand,
  ShortcutConfig,
} from "@/types";
import {
  InlineSegmented,
  PanelAction,
  SectionHeader,
  SettingBlock,
  SettingRow,
  Stepper,
} from "./PersonalizationPanelPrimitives";
import {
  clonePromptConfig,
  cloneShortcutConfig,
  EMPTY_PROMPTS,
  normalizePromptDraft,
  PROMPT_FIELDS,
  SHORTCUT_FIELDS,
} from "./personalizationPanelConfig";

type TranslateFn = (key: string, n?: number | string) => string;

function cyclePrev<T extends string>(values: T[], current: T): T {
  const index = values.indexOf(current);
  return values[(index - 1 + values.length) % values.length];
}

function cycleNext<T extends string>(values: T[], current: T): T {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length];
}

function usePromptDraftState(t: TranslateFn) {
  const promptConfig = useConfigStore((state) => state.promptConfig);
  const savePromptConfig = useConfigStore((state) => state.savePromptConfig);
  const [draft, setDraft] = useState<PromptConfig>(clonePromptConfig(promptConfig));
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(clonePromptConfig(promptConfig));
  }, [promptConfig]);

  const commitDraft = async (nextDraft: PromptConfig) => {
    setSaveError(null);
    try {
      await savePromptConfig(normalizePromptDraft(nextDraft));
    } catch {
      setSaveError(t("settings.saveError"));
    }
  };

  return { commitDraft, draft, saveError, setDraft, setSaveError };
}

function useShortcutDraftState(t: TranslateFn) {
  const shortcuts = useUIStore((state) => state.shortcuts);
  const setShortcut = useUIStore((state) => state.setShortcut);
  const resetShortcuts = useUIStore((state) => state.resetShortcuts);
  const [drafts, setDrafts] = useState<ShortcutConfig>(cloneShortcutConfig(shortcuts));
  const [errors, setErrors] = useState<Partial<Record<ShortcutCommand, string>>>({});

  useEffect(() => {
    setDrafts(cloneShortcutConfig(shortcuts));
  }, [shortcuts]);

  const commitShortcut = (command: ShortcutCommand) => {
    const normalized = normalizeShortcut(drafts[command]);
    if (!normalized) {
      setErrors((current) => ({
        ...current,
        [command]: t("settings.shortcuts.invalid"),
      }));
      return;
    }

    setErrors((current) => {
      const next = { ...current };
      delete next[command];
      return next;
    });
    setDrafts((current) => ({ ...current, [command]: normalized }));
    setShortcut(command, normalized);
  };

  return {
    commitShortcut,
    drafts,
    errors,
    resetShortcuts,
    setDrafts,
    setErrors,
  };
}

export function ReadingTab({ t }: { t: TranslateFn }) {
  const {
    fontSize,
    adjustFontSize,
    readingDensity,
    setReadingDensity,
    highlightStrength,
    setHighlightStrength,
    locale,
    setLocale,
    sidebarOpen,
    setSidebarOpen,
    sidebarTab,
    setSidebarTab,
    contentWidth,
    setContentWidth,
    pagePadding,
    setPagePadding,
    resetReadingPreferences,
  } = useUIStore();

  const densities: ReadingDensity[] = ["compact", "comfortable", "relaxed"];
  const highlights: HighlightStrength[] = ["subtle", "balanced", "strong"];

  return (
    <div className="px-5 py-2 pb-6">
      <SettingRow label={t("settings.theme")} description={t("settings.themeDesc")}>
        <ThemeSwitcher />
      </SettingRow>

      <SettingRow label={t("settings.fontSize")} description={t("settings.fontSizeDesc")}>
        <Stepper
          value={`${fontSize}px`}
          onDecrease={() => adjustFontSize(-1)}
          onIncrease={() => adjustFontSize(1)}
          ariaLabel="font size"
          testId="settings-font-controls"
        />
      </SettingRow>

      <SectionHeader title={t("settings.section.reading")} />

      <SettingRow
        label={t("settings.readingDensity")}
        description={t("settings.readingDensityDesc")}
      >
        <Stepper
          value={t(`settings.readingDensity.${readingDensity}`)}
          onDecrease={() => setReadingDensity(cyclePrev(densities, readingDensity))}
          onIncrease={() => setReadingDensity(cycleNext(densities, readingDensity))}
          width="w-20"
          ariaLabel="reading density"
          testId="settings-density-controls"
        />
      </SettingRow>

      <SettingRow
        label={t("settings.highlightStrength")}
        description={t("settings.highlightStrengthDesc")}
      >
        <Stepper
          value={t(`settings.highlightStrength.${highlightStrength}`)}
          onDecrease={() => setHighlightStrength(cyclePrev(highlights, highlightStrength))}
          onIncrease={() => setHighlightStrength(cycleNext(highlights, highlightStrength))}
          width="w-20"
          ariaLabel="highlight strength"
          testId="settings-highlight-controls"
        />
      </SettingRow>

      <SettingRow label={t("settings.language")} description={t("settings.languageDesc")}>
        <InlineSegmented
          options={[
            { value: "zh", label: t("settings.localeZh"), testId: "settings-locale-zh" },
            { value: "en", label: t("settings.localeEn"), testId: "settings-locale-en" },
          ]}
          value={locale}
          onChange={setLocale}
        />
      </SettingRow>

      <SectionHeader title={t("settings.section.layout")} />

      <SettingRow label={t("settings.sidebar")} description={t("settings.sidebarDesc")}>
        <InlineSegmented
          options={[
            { value: "open", label: t("settings.sidebar.open"), testId: "settings-sidebar-open" },
            { value: "closed", label: t("settings.sidebar.closed"), testId: "settings-sidebar-closed" },
          ]}
          value={sidebarOpen ? "open" : "closed"}
          onChange={(value) => setSidebarOpen(value === "open")}
        />
      </SettingRow>

      <SettingRow label={t("settings.sidebarTab")} description={t("settings.sidebarTabDesc")}>
        <InlineSegmented
          options={[
            { value: "outline", label: t("sidebar.outline"), testId: "settings-sidebar-tab-outline" },
            { value: "history", label: t("sidebar.history"), testId: "settings-sidebar-tab-history" },
          ]}
          value={sidebarTab}
          onChange={setSidebarTab}
        />
      </SettingRow>

      <SettingRow label={t("settings.contentWidth")} description={t("settings.contentWidthDesc")}>
        <InlineSegmented<ContentWidth>
          options={[
            { value: "narrow", label: t("settings.contentWidth.narrow"), testId: "settings-content-width-narrow" },
            { value: "standard", label: t("settings.contentWidth.standard"), testId: "settings-content-width-standard" },
            { value: "wide", label: t("settings.contentWidth.wide"), testId: "settings-content-width-wide" },
          ]}
          value={contentWidth}
          onChange={setContentWidth}
        />
      </SettingRow>

      <SettingRow label={t("settings.pagePadding")} description={t("settings.pagePaddingDesc")}>
        <InlineSegmented<PagePadding>
          options={[
            { value: "compact", label: t("settings.pagePadding.compact"), testId: "settings-page-padding-compact" },
            { value: "comfortable", label: t("settings.pagePadding.comfortable"), testId: "settings-page-padding-comfortable" },
            { value: "airy", label: t("settings.pagePadding.airy"), testId: "settings-page-padding-airy" },
          ]}
          value={pagePadding}
          onChange={setPagePadding}
        />
      </SettingRow>

      <div className="pt-4">
        <PanelAction
          label={t("settings.readingReset")}
          onClick={resetReadingPreferences}
          testId="settings-reading-reset"
        />
      </div>
    </div>
  );
}

export function PromptsTab({ t }: { t: TranslateFn }) {
  const { commitDraft, draft, saveError, setDraft } = usePromptDraftState(t);

  return (
    <div className="px-5 py-2 pb-6">
      <p className="pb-3 text-xs text-text-muted">{t("settings.promptsIntro")}</p>

      {PROMPT_FIELDS.map((field) => {
        const value = draft[field.key] ?? "";
        const defaultHeader = resolvePromptHeader(field.locale, field.mode, null);

        return (
          <SettingBlock
            key={field.key}
            label={t(field.labelKey)}
            description={t("settings.promptsFieldDesc")}
          >
            <textarea
              value={value}
              rows={3}
              onChange={(event) => {
                const nextDraft = {
                  ...draft,
                  [field.key]: event.target.value,
                } as PromptConfig;
                setDraft(nextDraft);
              }}
              onBlur={() => void commitDraft(draft)}
              placeholder={defaultHeader}
              className="w-full rounded-xl border border-border-subtle/60 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-faint focus:border-accent"
              data-testid={`settings-prompt-${field.key}`}
            />
            <div className="mt-2 text-xs text-text-subtle">
              {t("settings.promptsDefaultLabel")}: {defaultHeader}
            </div>
          </SettingBlock>
        );
      })}

      <div className="flex items-center justify-between gap-3 pt-4">
        <PanelAction
          label={t("settings.promptsReset")}
          onClick={() => {
            setDraft(EMPTY_PROMPTS);
            void commitDraft(EMPTY_PROMPTS);
          }}
          testId="settings-prompts-reset"
        />
        {saveError ? <span className="text-xs text-kind-challenge-text">{saveError}</span> : null}
      </div>
    </div>
  );
}

export function ShortcutsTab({ t }: { t: TranslateFn }) {
  const {
    commitShortcut,
    drafts,
    errors,
    resetShortcuts,
    setDrafts,
    setErrors,
  } = useShortcutDraftState(t);

  return (
    <div className="px-5 py-2 pb-6">
      <p className="pb-3 text-xs text-text-muted">{t("settings.shortcutsIntro")}</p>

      {SHORTCUT_FIELDS.map((field) => (
        <SettingBlock
          key={field.command}
          label={t(field.labelKey)}
          description={t(field.descKey)}
        >
          <input
            value={drafts[field.command]}
            onChange={(event) => {
              setDrafts((current) => ({
                ...current,
                [field.command]: event.target.value,
              }));
            }}
            onBlur={() => commitShortcut(field.command)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitShortcut(field.command);
                event.currentTarget.blur();
              }
            }}
            className="w-full rounded-xl border border-border-subtle/60 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-faint focus:border-accent"
            placeholder={DEFAULT_SHORTCUTS[field.command]}
            data-testid={`settings-shortcut-${field.command}`}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-text-subtle">
              {t("settings.shortcuts.example")}: {DEFAULT_SHORTCUTS[field.command]}
            </span>
            {errors[field.command] ? (
              <span className="text-xs text-kind-challenge-text">{errors[field.command]}</span>
            ) : null}
          </div>
        </SettingBlock>
      ))}

      <div className="space-y-3 pt-4">
        <PanelAction
          label={t("settings.shortcutsReset")}
          onClick={() => {
            setErrors({});
            setDrafts(cloneShortcutConfig(DEFAULT_SHORTCUTS));
            resetShortcuts();
          }}
          testId="settings-shortcuts-reset"
        />
        <div className="rounded-xl border border-border-subtle/50 bg-surface-card px-3 py-3 text-xs text-text-muted">
          {t("settings.shortcutsPriorityNote")}
        </div>
      </div>
    </div>
  );
}

export function IntegrationsTab({ t }: { t: TranslateFn }) {
  const configStatus = useConfigStore((state) => state.configStatus);

  return (
    <div className="space-y-4 px-5 py-4 pb-6">
      <div className="rounded-xl border border-border-subtle/50 bg-surface-card px-4 py-4">
        <div className="text-sm font-medium text-text-strong">
          {t("settings.integrations.clivConfig")}
        </div>
        <div className="mt-1 text-xs text-text-muted">
          {configStatus?.path ?? "~/.cliv/config.toml"}
        </div>
        <div className="mt-3 text-xs text-text-muted">
          {configStatus?.exists
            ? t("settings.integrations.clivConfigExists")
            : t("settings.integrations.clivConfigPending")}
        </div>
        <div className="mt-1 text-xs text-text-muted">
          {configStatus?.uiConfigured
            ? t("settings.integrations.uiFromConfig")
            : t("settings.integrations.uiFromLegacy")}
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle/50 bg-surface-card px-4 py-4">
        <div className="text-sm font-medium text-text-strong">
          {t("settings.integrations.agentBoundaryTitle")}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {t("settings.integrations.agentBoundaryDesc")}
        </p>
        <div className="mt-3 space-y-2 text-xs text-text-muted">
          <div>Codex: `~/.codex/config.toml`</div>
          <div>Claude: `~/.claude/settings.json`</div>
          <div>Gemini: `~/.gemini/settings.json`</div>
        </div>
      </div>
    </div>
  );
}
