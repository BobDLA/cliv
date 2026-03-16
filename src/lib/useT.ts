import { useCallback } from "react";
import { useUIStore } from "@/stores";
import { messages } from "./locales";

/**
 * useT — lightweight i18n hook.
 *
 * Returns a `t(key, vars?)` function that resolves the current locale's
 * string from the dictionary. Supports `{n}` placeholder interpolation.
 *
 * Usage:
 *   const t = useT();
 *   t("app.loading")          // → "加载文档..." or "Loading document..."
 *   t("time.minutesAgo", 5)   // → "5分钟前" or "5m ago"
 */
export function useT() {
  const locale = useUIStore((s) => s.locale);

  return useCallback(
    (key: string, n?: number | string): string => {
      const str = messages[locale]?.[key] ?? messages.en?.[key] ?? key;
      if (n !== undefined) {
        return str.replace("{n}", String(n));
      }
      return str;
    },
    [locale],
  );
}
