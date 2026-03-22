import type { ShortcutCommand, ShortcutConfig } from "@/types";

export const SHORTCUT_COMMANDS: ShortcutCommand[] = [
  "openFile",
  "search",
  "submitReturn",
  "submitAnnotation",
  "addAnnotation",
  "fontIncrease",
  "fontDecrease",
  "fontReset",
];

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  openFile: "Mod+O",
  search: "Mod+F",
  submitReturn: "Mod+Enter",
  submitAnnotation: "Mod+Enter",
  addAnnotation: "Mod+Alt+M",
  fontIncrease: "Mod+=",
  fontDecrease: "Mod+-",
  fontReset: "Mod+0",
};

export interface ShortcutDefinition {
  mod: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
  canonical: string;
}

const SPECIAL_KEYS = new Map<string, string>([
  ["enter", "Enter"],
  ["return", "Enter"],
  ["escape", "Escape"],
  ["esc", "Escape"],
  ["=", "="],
  ["plus", "="],
  ["-", "-"],
  ["minus", "-"],
  [",", ","],
  ["comma", ","],
  [".", "."],
  ["period", "."],
  ["dot", "."],
  ["/", "/"],
  ["slash", "/"],
]);

export function cloneShortcutConfig(shortcuts: ShortcutConfig): ShortcutConfig {
  return { ...shortcuts };
}

export function getDefaultShortcuts(): ShortcutConfig {
  return cloneShortcutConfig(DEFAULT_SHORTCUTS);
}

export function normalizeShortcut(value: string): string | null {
  return parseShortcut(value)?.canonical ?? null;
}

export function parseShortcut(value: string | null | undefined): ShortcutDefinition | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  let mod = false;
  let alt = false;
  let shift = false;
  let key: string | null = null;

  for (const rawToken of trimmed.split("+")) {
    const token = rawToken.trim();
    if (!token) return null;

    switch (token.toLowerCase()) {
      case "mod":
      case "cmd":
      case "command":
      case "meta":
      case "ctrl":
      case "control":
        if (mod) return null;
        mod = true;
        break;
      case "alt":
      case "option":
        if (alt) return null;
        alt = true;
        break;
      case "shift":
        if (shift) return null;
        shift = true;
        break;
      default: {
        if (key != null) return null;
        key = normalizePrimaryKey(token);
        if (key == null) return null;
      }
    }
  }

  if (!(mod || alt || shift) || key == null) {
    return null;
  }

  const parts = [
    mod ? "Mod" : null,
    alt ? "Alt" : null,
    shift ? "Shift" : null,
    key,
  ].filter((part): part is string => part != null);

  return {
    mod,
    alt,
    shift,
    key,
    canonical: parts.join("+"),
  };
}

export function resolveShortcut(
  configured: string | null | undefined,
  fallback: string,
): string {
  return normalizeShortcut(configured ?? "") ?? fallback;
}

export function resolveShortcutConfig(
  shortcuts: Partial<ShortcutConfig> | null | undefined,
): ShortcutConfig {
  return {
    openFile: resolveShortcut(shortcuts?.openFile, DEFAULT_SHORTCUTS.openFile),
    search: resolveShortcut(shortcuts?.search, DEFAULT_SHORTCUTS.search),
    submitReturn: resolveShortcut(shortcuts?.submitReturn, DEFAULT_SHORTCUTS.submitReturn),
    submitAnnotation: resolveShortcut(
      shortcuts?.submitAnnotation,
      DEFAULT_SHORTCUTS.submitAnnotation,
    ),
    addAnnotation: resolveShortcut(
      shortcuts?.addAnnotation,
      DEFAULT_SHORTCUTS.addAnnotation,
    ),
    fontIncrease: resolveShortcut(
      shortcuts?.fontIncrease,
      DEFAULT_SHORTCUTS.fontIncrease,
    ),
    fontDecrease: resolveShortcut(
      shortcuts?.fontDecrease,
      DEFAULT_SHORTCUTS.fontDecrease,
    ),
    fontReset: resolveShortcut(shortcuts?.fontReset, DEFAULT_SHORTCUTS.fontReset),
  };
}

export function matchShortcut(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
  shortcut: string | null | undefined,
): boolean {
  const parsed = parseShortcut(shortcut);
  if (parsed == null) return false;

  const modPressed = event.ctrlKey || event.metaKey;
  if (parsed.mod !== modPressed) return false;
  if (parsed.alt !== event.altKey) return false;

  const normalizedEventKey = normalizeEventKey(event.key);
  if (normalizedEventKey == null) return false;

  const keyMatches = normalizedEventKey === parsed.key;
  if (!keyMatches) return false;

  if (parsed.key === "=" && !parsed.shift && event.key === "+") {
    return true;
  }

  return parsed.shift === event.shiftKey;
}

function normalizePrimaryKey(token: string): string | null {
  const special = SPECIAL_KEYS.get(token.toLowerCase());
  if (special != null) return special;

  if (token.length === 1 && /[a-z0-9]/i.test(token)) {
    return token.toUpperCase();
  }

  return null;
}

function normalizeEventKey(key: string): string | null {
  const special = SPECIAL_KEYS.get(key.toLowerCase());
  if (special != null) return special;

  if (key.length === 1 && /[a-z0-9]/i.test(key)) {
    return key.toUpperCase();
  }

  return null;
}
