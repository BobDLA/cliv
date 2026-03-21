import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { ThemeSwitcher } from "@/features/documents/ThemeSwitcher";
import { useUIStore } from "@/stores";
import type {
  ContentWidth,
  HighlightStrength,
  PagePadding,
  ReadingDensity,
  SidebarTab,
} from "@/types";
import { useT } from "@/lib/useT";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  testId: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-text-subtle">
        {label}
      </div>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="grid gap-1 rounded-xl bg-surface-app p-1"
      style={{
        gridTemplateColumns: "repeat(" + options.length + ", minmax(0, 1fr))",
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        const className = [
          "rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
          active
            ? "bg-accent text-white shadow-sm"
            : "text-text-muted hover:bg-surface-hover hover:text-text-primary",
        ].join(" ");

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={className}
            data-testid={option.testId}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function PersonalizationPanel() {
  const {
    fontSize,
    adjustFontSize,
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
    readingDensity,
    setReadingDensity,
    highlightStrength,
    setHighlightStrength,
    resetPreferences,
  } = useUIStore();
  const t = useT();

  const sidebarOptions: SegmentedOption<"open" | "closed">[] = [
    {
      value: "open",
      label: t("settings.sidebar.open"),
      testId: "settings-sidebar-open",
    },
    {
      value: "closed",
      label: t("settings.sidebar.closed"),
      testId: "settings-sidebar-closed",
    },
  ];
  const tabOptions: SegmentedOption<SidebarTab>[] = [
    {
      value: "outline",
      label: t("sidebar.outline"),
      testId: "settings-sidebar-tab-outline",
    },
    {
      value: "history",
      label: t("sidebar.history"),
      testId: "settings-sidebar-tab-history",
    },
  ];
  const contentWidthOptions: SegmentedOption<ContentWidth>[] = [
    {
      value: "narrow",
      label: t("settings.contentWidth.narrow"),
      testId: "settings-content-width-narrow",
    },
    {
      value: "standard",
      label: t("settings.contentWidth.standard"),
      testId: "settings-content-width-standard",
    },
    {
      value: "wide",
      label: t("settings.contentWidth.wide"),
      testId: "settings-content-width-wide",
    },
  ];
  const pagePaddingOptions: SegmentedOption<PagePadding>[] = [
    {
      value: "compact",
      label: t("settings.pagePadding.compact"),
      testId: "settings-page-padding-compact",
    },
    {
      value: "comfortable",
      label: t("settings.pagePadding.comfortable"),
      testId: "settings-page-padding-comfortable",
    },
    {
      value: "airy",
      label: t("settings.pagePadding.airy"),
      testId: "settings-page-padding-airy",
    },
  ];
  const densityOptions: SegmentedOption<ReadingDensity>[] = [
    {
      value: "compact",
      label: t("settings.readingDensity.compact"),
      testId: "settings-density-compact",
    },
    {
      value: "comfortable",
      label: t("settings.readingDensity.comfortable"),
      testId: "settings-density-comfortable",
    },
    {
      value: "relaxed",
      label: t("settings.readingDensity.relaxed"),
      testId: "settings-density-relaxed",
    },
  ];
  const highlightOptions: SegmentedOption<HighlightStrength>[] = [
    {
      value: "subtle",
      label: t("settings.highlightStrength.subtle"),
      testId: "settings-highlight-subtle",
    },
    {
      value: "balanced",
      label: t("settings.highlightStrength.balanced"),
      testId: "settings-highlight-balanced",
    },
    {
      value: "strong",
      label: t("settings.highlightStrength.strong"),
      testId: "settings-highlight-strong",
    },
  ];

  return (
    <div
      className="absolute right-0 top-[calc(100%+12px)] z-30 w-[380px] rounded-2xl border border-border-strong/70 bg-surface-popover p-4 shadow-2xl shadow-black/20"
      role="dialog"
      aria-label={t("settings.title")}
      data-testid="personalization-panel"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-text-strong">
            {t("settings.title")}
          </h2>
          <p className="text-xs text-text-muted">{t("settings.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={resetPreferences}
          className="inline-flex items-center gap-1 rounded-lg border border-border-subtle/70 px-2.5 py-1.5 text-xs font-medium text-text-subtle transition-colors hover:border-accent/30 hover:bg-surface-hover hover:text-text-primary"
          data-testid="settings-reset"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("settings.reset")}
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <section className="space-y-3">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-text-faint">
            {t("settings.appearance")}
          </div>
          <SettingRow label={t("settings.theme")}>
            <ThemeSwitcher />
          </SettingRow>
          <SettingRow label={t("settings.fontSize")}>
            <div
              className="inline-flex items-center gap-1 rounded-xl border border-border-subtle/60 bg-surface-app px-2 py-1"
              data-testid="settings-font-controls"
            >
              <button
                type="button"
                onClick={() => adjustFontSize(-1)}
                className="rounded p-1 text-text-subtle transition-colors hover:bg-surface-hover hover:text-text-primary"
                title={t("topbar.zoomOut")}
                data-testid="settings-font-decrease"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span
                className="min-w-[2.5rem] text-center font-mono text-sm text-text-primary"
                data-testid="settings-font-size"
              >
                {fontSize}
              </span>
              <button
                type="button"
                onClick={() => adjustFontSize(1)}
                className="rounded p-1 text-text-subtle transition-colors hover:bg-surface-hover hover:text-text-primary"
                title={t("topbar.zoomIn")}
                data-testid="settings-font-increase"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </SettingRow>
          <SettingRow label={t("settings.language")}>
            <SegmentedControl
              options={[
                {
                  value: "zh",
                  label: t("settings.localeZh"),
                  testId: "settings-locale-zh",
                },
                {
                  value: "en",
                  label: t("settings.localeEn"),
                  testId: "settings-locale-en",
                },
              ]}
              value={locale}
              onChange={setLocale}
            />
          </SettingRow>
        </section>

        <section className="space-y-3">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-text-faint">
            {t("settings.layout")}
          </div>
          <SettingRow label={t("settings.sidebar")}>
            <SegmentedControl
              options={sidebarOptions}
              value={sidebarOpen ? "open" : "closed"}
              onChange={(value) => setSidebarOpen(value === "open")}
            />
          </SettingRow>
          <SettingRow label={t("settings.sidebarTab")}>
            <SegmentedControl
              options={tabOptions}
              value={sidebarTab}
              onChange={setSidebarTab}
            />
          </SettingRow>
        </section>

        <section className="space-y-3">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-text-faint">
            {t("settings.reading")}
          </div>
          <SettingRow label={t("settings.contentWidth")}>
            <SegmentedControl
              options={contentWidthOptions}
              value={contentWidth}
              onChange={setContentWidth}
            />
          </SettingRow>
          <SettingRow label={t("settings.pagePadding")}>
            <SegmentedControl
              options={pagePaddingOptions}
              value={pagePadding}
              onChange={setPagePadding}
            />
          </SettingRow>
          <SettingRow label={t("settings.readingDensity")}>
            <SegmentedControl
              options={densityOptions}
              value={readingDensity}
              onChange={setReadingDensity}
            />
          </SettingRow>
          <SettingRow label={t("settings.highlightStrength")}>
            <SegmentedControl
              options={highlightOptions}
              value={highlightStrength}
              onChange={setHighlightStrength}
            />
          </SettingRow>
        </section>
      </div>
    </div>
  );
}
