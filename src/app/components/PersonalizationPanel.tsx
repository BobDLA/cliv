import { useEffect, useState } from "react";
import { RotateCcw, Minus, Plus, X } from "lucide-react";
import { ThemeSwitcher } from "@/features/documents/ThemeSwitcher";
import { DEFAULT_SHORTCUTS, normalizeShortcut } from "@/lib/shortcuts";
import { resolvePromptHeader } from "@/lib/promptTemplates";
import { useT } from "@/lib/useT";
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

type SettingsTab = "reading" | "prompts" | "shortcuts" | "integrations";
type PromptFieldKey = keyof PromptConfig;

const TABS: SettingsTab[] = ["reading", "prompts", "shortcuts", "integrations"];
const SHORTCUT_FIELDS: Array<{
  command: ShortcutCommand;
  labelKey: string;
  descKey: string;
}> = [
  {
    command: "openFile",
    labelKey: "settings.shortcuts.openFile",
    descKey: "settings.shortcuts.openFileDesc",
  },
  {
    command: "search",
    labelKey: "settings.shortcuts.search",
    descKey: "settings.shortcuts.searchDesc",
  },
  {
    command: "submitReturn",
    labelKey: "settings.shortcuts.submitReturn",
    descKey: "settings.shortcuts.submitReturnDesc",
  },
  {
    command: "submitAnnotation",
    labelKey: "settings.shortcuts.submitAnnotation",
    descKey: "settings.shortcuts.submitAnnotationDesc",
  },
  {
    command: "addAnnotation",
    labelKey: "settings.shortcuts.addAnnotation",
    descKey: "settings.shortcuts.addAnnotationDesc",
  },
  {
    command: "fontIncrease",
    labelKey: "settings.shortcuts.fontIncrease",
    descKey: "settings.shortcuts.fontIncreaseDesc",
  },
  {
    command: "fontDecrease",
    labelKey: "settings.shortcuts.fontDecrease",
    descKey: "settings.shortcuts.fontDecreaseDesc",
  },
  {
    command: "fontReset",
    labelKey: "settings.shortcuts.fontReset",
    descKey: "settings.shortcuts.fontResetDesc",
  },
];
const EMPTY_PROMPTS: PromptConfig = {
  replyHeaderZh: null,
  replyHeaderEn: null,
  iterateHeaderZh: null,
  iterateHeaderEn: null,
};
const PROMPT_FIELDS: Array<{
  key: PromptFieldKey;
  labelKey: string;
  locale: "zh" | "en";
  mode: "reply" | "iterate";
}> = [
  {
    key: "replyHeaderZh",
    labelKey: "settings.prompts.replyHeaderZh",
    locale: "zh",
    mode: "reply",
  },
  {
    key: "replyHeaderEn",
    labelKey: "settings.prompts.replyHeaderEn",
    locale: "en",
    mode: "reply",
  },
  {
    key: "iterateHeaderZh",
    labelKey: "settings.prompts.iterateHeaderZh",
    locale: "zh",
    mode: "iterate",
  },
  {
    key: "iterateHeaderEn",
    labelKey: "settings.prompts.iterateHeaderEn",
    locale: "en",
    mode: "iterate",
  },
];

function normalizePromptDraft(draft: PromptConfig): PromptConfig {
  const normalize = (value: string | null) => {
    const trimmed = value?.trim() ?? "";
    return trimmed ? trimmed : null;
  };

  return {
    replyHeaderZh: normalize(draft.replyHeaderZh),
    replyHeaderEn: normalize(draft.replyHeaderEn),
    iterateHeaderZh: normalize(draft.iterateHeaderZh),
    iterateHeaderEn: normalize(draft.iterateHeaderEn),
  };
}

function clonePromptConfig(prompts: PromptConfig | null | undefined): PromptConfig {
  return {
    replyHeaderZh: prompts?.replyHeaderZh ?? null,
    replyHeaderEn: prompts?.replyHeaderEn ?? null,
    iterateHeaderZh: prompts?.iterateHeaderZh ?? null,
    iterateHeaderEn: prompts?.iterateHeaderEn ?? null,
  };
}

function cloneShortcutConfig(shortcuts: ShortcutConfig): ShortcutConfig {
  return { ...shortcuts };
}

function TabBar({
  active,
  onChange,
  tabs,
}: {
  active: SettingsTab;
  onChange: (tab: SettingsTab) => void;
  tabs: { value: SettingsTab; label: string }[];
}) {
  return (
    <div className="flex gap-1" role="tablist" data-testid="settings-tabbar">
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              isActive
                ? "bg-surface-card text-text-strong shadow-sm"
                : "text-text-muted hover:bg-surface-hover hover:text-text-primary",
            ].join(" ")}
            data-testid={`settings-tab-${tab.value}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="pb-1 pt-4 first:pt-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-subtle">
        {title}
      </span>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-subtle/30 py-3.5 last:border-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-text-strong">{label}</span>
        {description ? (
          <span className="text-xs text-text-muted">{description}</span>
        ) : null}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SettingBlock({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border-subtle/30 py-3.5 last:border-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-text-strong">{label}</span>
        {description ? (
          <span className="text-xs text-text-muted">{description}</span>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Stepper({
  value,
  onDecrease,
  onIncrease,
  width = "w-14",
  ariaLabel,
  testId,
}: {
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
  width?: string;
  ariaLabel: string;
  testId: string;
}) {
  return (
    <div
      className="flex items-center overflow-hidden rounded-lg border border-border-subtle/60 bg-surface-card shadow-sm"
      data-testid={testId}
    >
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel}`}
        onClick={onDecrease}
        className="flex items-center justify-center px-2 py-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary focus:outline-none"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span
        className={`${width} border-x border-border-subtle/60 bg-surface-card py-1.5 text-center text-sm font-medium text-text-strong`}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${ariaLabel}`}
        onClick={onIncrease}
        className="flex items-center justify-center px-2 py-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary focus:outline-none"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function InlineSegmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; testId: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border-subtle/60 bg-surface-card-strong/40 p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              active
                ? "bg-accent text-white shadow-sm"
                : "text-text-muted hover:bg-surface-hover hover:text-text-primary",
            ].join(" ")}
            data-testid={opt.testId}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PanelAction({
  label,
  onClick,
  testId,
}: {
  label: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle/60 bg-surface-card px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:border-accent/30 hover:bg-surface-hover hover:text-text-primary"
      data-testid={testId}
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ReadingTab({ t }: { t: (key: string) => string }) {
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

  const cyclePrev = <T extends string>(arr: T[], current: T) => {
    const idx = arr.indexOf(current);
    return arr[(idx - 1 + arr.length) % arr.length];
  };
  const cycleNext = <T extends string>(arr: T[], current: T) => {
    const idx = arr.indexOf(current);
    return arr[(idx + 1) % arr.length];
  };

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

function PromptsTab({ t }: { t: (key: string) => string }) {
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

function ShortcutsTab({ t }: { t: (key: string) => string }) {
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

function IntegrationsTab({ t }: { t: (key: string) => string }) {
  const configStatus = useConfigStore((state) => state.configStatus);

  return (
    <div className="space-y-4 px-5 py-4 pb-6">
      <div className="rounded-xl border border-border-subtle/50 bg-surface-card px-4 py-4">
        <div className="text-sm font-medium text-text-strong">
          {t("settings.integrations.clivConfig")}
        </div>
        <div className="mt-1 text-xs text-text-muted">{configStatus?.path ?? "~/.cliv/config.toml"}</div>
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

interface PersonalizationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function PersonalizationPanel({ open, onClose }: PersonalizationPanelProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<SettingsTab>("reading");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  const tabDefs = TABS.map((tab) => ({
    value: tab,
    label: t(`settings.tab.${tab}`),
  }));

  return (
    <div
      className={[
        "flex h-full w-[26rem] flex-shrink-0 flex-col border-l border-border-subtle/50 bg-surface-sidebar transition-all duration-300 ease-out",
        visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
      ].join(" ")}
      role="dialog"
      aria-label={t("settings.title")}
      data-testid="personalization-panel"
    >
      <div className="flex items-center justify-between border-b border-border-subtle/40 px-4 py-3">
        <TabBar active={activeTab} onChange={setActiveTab} tabs={tabDefs} />
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-text-subtle transition-colors hover:bg-surface-hover hover:text-text-primary"
          aria-label="Close settings"
          data-testid="settings-close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "reading" && <ReadingTab t={t} />}
        {activeTab === "prompts" && <PromptsTab t={t} />}
        {activeTab === "shortcuts" && <ShortcutsTab t={t} />}
        {activeTab === "integrations" && <IntegrationsTab t={t} />}
      </div>
    </div>
  );
}
