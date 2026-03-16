import { memo } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useUIStore } from "@/stores";
import type { Theme } from "@/types";

const themes: { value: Theme; icon: typeof Sun; title: string }[] = [
  { value: "dark", icon: Moon, title: "深色" },
  { value: "dim", icon: Monitor, title: "柔和" },
  { value: "light", icon: Sun, title: "浅色" },
];

/**
 * ThemeSwitcher — icon-only toggle row.
 * Active icon gets accent background + white fill; inactive are subtle.
 */
export const ThemeSwitcher = memo(function ThemeSwitcher() {
  const { theme, setTheme } = useUIStore();

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        padding: "2px",
        borderRadius: "8px",
        backgroundColor: "var(--color-surface-hover)",
      }}
      data-testid="theme-switcher"
      role="radiogroup"
      aria-label="主题切换"
    >
      {themes.map((t) => {
        const active = theme === t.value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            role="radio"
            aria-checked={active}
            title={t.title}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "26px",
              height: "26px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              backgroundColor: active ? "var(--color-accent)" : "transparent",
              color: active ? "#fff" : "var(--color-text-secondary)",
            }}
          >
            <Icon style={{ width: "14px", height: "14px" }} />
          </button>
        );
      })}
    </div>
  );
});
