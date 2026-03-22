import { useState, useEffect } from "react";
import { RotateCcw, Minus, Plus, X } from "lucide-react";
import { ThemeSwitcher } from "@/features/documents/ThemeSwitcher";
import { useUIStore } from "@/stores";
import type {
  ContentWidth,
  HighlightStrength,
  PagePadding,
  ReadingDensity,
} from "@/types";
import { useT } from "@/lib/useT";

/* ── Tab types ─────────────────────────────────────────────── */

type SettingsTab = "appearance" | "layout" | "advanced";

const TABS: SettingsTab[] = ["appearance", "layout", "advanced"];

/* ── Sub-components ────────────────────────────────────────── */

/**
 * Underline tab bar for drawer header.
 */
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

/**
 * Section header — small divider between groups of settings.
 */
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="pb-1 pt-4 first:pt-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-subtle">
        {title}
      </span>
    </div>
  );
}

/**
 * Setting row — label + description on left, control on right.
 */
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

/**
 * Stepper control — `−` value `+`.
 */
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

/**
 * Segmented control — small inline selection buttons.
 */
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

/* ── Tab content panels ────────────────────────────────────── */

function AppearanceTab({ t }: { t: (key: string) => string }) {
  const {
    fontSize,
    adjustFontSize,
    readingDensity,
    setReadingDensity,
    highlightStrength,
    setHighlightStrength,
    locale,
    setLocale,
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

      <SectionHeader title={t("settings.section.language")} />

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
    </div>
  );
}

function LayoutTab({ t }: { t: (key: string) => string }) {
  const {
    sidebarOpen,
    setSidebarOpen,
    sidebarTab,
    setSidebarTab,
    contentWidth,
    setContentWidth,
    pagePadding,
    setPagePadding,
  } = useUIStore();

  return (
    <div className="px-5 py-2 pb-6">
      <SettingRow label={t("settings.sidebar")}>
        <InlineSegmented
          options={[
            { value: "open", label: t("settings.sidebar.open"), testId: "settings-sidebar-open" },
            { value: "closed", label: t("settings.sidebar.closed"), testId: "settings-sidebar-closed" },
          ]}
          value={sidebarOpen ? "open" : "closed"}
          onChange={(v) => setSidebarOpen(v === "open")}
        />
      </SettingRow>

      <SettingRow label={t("settings.sidebarTab")}>
        <InlineSegmented
          options={[
            { value: "outline", label: t("sidebar.outline"), testId: "settings-sidebar-tab-outline" },
            { value: "history", label: t("sidebar.history"), testId: "settings-sidebar-tab-history" },
          ]}
          value={sidebarTab}
          onChange={setSidebarTab}
        />
      </SettingRow>

      <SettingRow label={t("settings.contentWidth")}>
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

      <SettingRow label={t("settings.pagePadding")}>
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
    </div>
  );
}

function AdvancedTab({ t, onReset }: { t: (key: string) => string; onReset: () => void }) {
  return (
    <div className="px-5 py-2 pb-6">
      <SettingRow label={t("settings.resetTitle")} description={t("settings.resetDesc")}>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle/60 bg-surface-card px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:border-accent/30 hover:bg-surface-hover hover:text-text-primary"
          data-testid="settings-reset"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("settings.reset")}
        </button>
      </SettingRow>
    </div>
  );
}

/* ── Main Component — Right-side Drawer ────────────────────── */

interface PersonalizationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function PersonalizationPanel({ open, onClose }: PersonalizationPanelProps) {
  const { resetPreferences } = useUIStore();
  const t = useT();
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const [visible, setVisible] = useState(false);

  // Slide-in animation: mount → visible (next frame)
  useEffect(() => {
    if (open) {
      // Force reflow before adding visible class
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
        "flex h-full w-96 flex-shrink-0 flex-col border-l border-border-subtle/50 bg-surface-sidebar transition-all duration-300 ease-out",
        visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
      ].join(" ")}
      role="dialog"
      aria-label={t("settings.title")}
      data-testid="personalization-panel"
    >
      {/* Drawer Header */}
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

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "appearance" && <AppearanceTab t={t} />}
        {activeTab === "layout" && <LayoutTab t={t} />}
        {activeTab === "advanced" && <AdvancedTab t={t} onReset={resetPreferences} />}
      </div>
    </div>
  );
}
