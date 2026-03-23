import type { ReactNode } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { SettingsTab } from "./personalizationPanelConfig";

export function TabBar({
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

export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="pb-1 pt-4 first:pt-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-subtle">
        {title}
      </span>
    </div>
  );
}

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
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

export function SettingBlock({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
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

export function Stepper({
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

export function InlineSegmented<T extends string>({
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

export function PanelAction({
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
