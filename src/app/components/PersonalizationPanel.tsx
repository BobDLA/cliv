import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/useT";
import { TabBar } from "./PersonalizationPanelPrimitives";
import {
  IntegrationsTab,
  PromptsTab,
  ReadingTab,
  ShortcutsTab,
} from "./PersonalizationPanelTabs";
import { type SettingsTab, TABS } from "./personalizationPanelConfig";

interface PersonalizationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function PersonalizationPanel({
  open,
  onClose,
}: PersonalizationPanelProps) {
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

  if (!open) {
    return null;
  }

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
