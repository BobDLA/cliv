/**
 * locales.ts — centralized i18n dictionary for cliV UI.
 *
 * All user-facing strings live here. Components use `useT()` to access them.
 * Prompt output strings (sent to AI agents) are also translated here
 * so that the output matches the user's selected UI language.
 */

export type Locale = "zh" | "en";

const zh = {
  // ── App ──
  "app.loading": "加载文档...",
  "app.errorTitle": "加载错误",
  "app.errorHint": "请检查文件路径或使用",
  "app.errorHintOpen": "打开",
  "app.readFileFail": "读取文件失败",

  // ── TopBar ──
  "topbar.collapseSidebar": "收起侧栏",
  "topbar.expandSidebar": "展开侧栏",
  "topbar.openFile": "打开文件 (Ctrl+O)",
  "topbar.zoomOut": "缩小 (Ctrl+-)",
  "topbar.zoomIn": "放大 (Ctrl+=)",

  // ── LeftSidebar ──
  "sidebar.outline": "大纲",
  "sidebar.history": "历史",
  "sidebar.save": "保存",
  "sidebar.saveSession": "保存会话",
  "history.searchPlaceholder": "搜索历史...",
  "history.noHistory": "暂无历史归档",
  "history.emptyHint": "提交反馈后会在此处按项目分组显示",
  "history.noMatch": "没有匹配结果",
  "history.noMatchHint": "换个关键词试试",
  "history.loadError": "历史加载失败",
  "history.charsSuffix": "字",
  "history.itemsSuffix": "条",
  "history.pathLabel": "项目路径",
  "history.copyPath": "复制路径",
  "history.pathCopied": "已复制",
  "history.groupCount": "{n} 条",
  "history.expandGroup": "展开项目",
  "history.collapseGroup": "收起项目",
  "history.archivesTab": "归档记录",
  "history.sessionsTab": "保存会话",
  "history.readOnlyMode": "历史回看",
  "history.readOnlyBadge": "当前正在查看只读历史归档",
  "history.readOnlyHint": "当前内容是历史归档快照，仅供回看与对照，不会写回原文件。",

  // ── DocumentArea ──
  "docarea.hint": "或点击下方按钮打开文件。",
  "docarea.hintUse": "使用",
  "docarea.openMarkdown": "打开 Markdown 文件",

  // ── DocumentOutline ──
  "outline.noHeadings": "无标题",
  "outline.toc": "目录",
  "outline.ariaLabel": "文档目录",

  // ── DocumentSearch ──
  "search.placeholder": "搜索文档...",
  "search.noResult": "无结果",

  // ── ThemeSwitcher ──
  "theme.dark": "深色",
  "theme.dim": "柔和",
  "theme.light": "浅色",
  "theme.ariaLabel": "主题切换",

  // ── Settings ──
  "settings.open": "界面设置",
  "settings.title": "界面设置",
  "settings.subtitle": "统一管理阅读偏好、提示头和快捷命令。",
  "settings.reset": "恢复默认",
  "settings.resetTitle": "恢复默认设置",
  "settings.resetDesc": "将所有设置恢复为默认值。",
  "settings.appearance": "外观",
  "settings.layout": "布局",
  "settings.reading": "阅读",
  "settings.tab.reading": "阅读",
  "settings.tab.prompts": "提示词",
  "settings.tab.shortcuts": "快捷键",
  "settings.tab.integrations": "集成",
  "settings.section.reading": "阅读",
  "settings.section.language": "语言",
  "settings.section.layout": "布局",
  "settings.theme": "主题",
  "settings.themeDesc": "选择界面外观主题。",
  "settings.fontSize": "字号",
  "settings.fontSizeDesc": "调整文章和笔记的默认字号。",
  "settings.language": "语言",
  "settings.languageDesc": "选择界面显示语言。",
  "settings.sidebar": "侧栏",
  "settings.sidebarDesc": "控制侧栏的默认显示状态。",
  "settings.sidebar.open": "展开",
  "settings.sidebar.closed": "收起",
  "settings.sidebarTab": "默认标签",
  "settings.sidebarTabDesc": "设置侧栏默认打开的标签页。",
  "settings.contentWidth": "内容宽度",
  "settings.contentWidthDesc": "控制阅读区域的最大宽度。",
  "settings.contentWidth.narrow": "窄",
  "settings.contentWidth.standard": "标准",
  "settings.contentWidth.wide": "宽",
  "settings.pagePadding": "页面留白",
  "settings.pagePaddingDesc": "调整页面内容周围的留白空间。",
  "settings.pagePadding.compact": "紧凑",
  "settings.pagePadding.comfortable": "舒适",
  "settings.pagePadding.airy": "宽松",
  "settings.readingDensity": "阅读密度",
  "settings.readingDensityDesc": "调整文本行间距。",
  "settings.readingDensity.compact": "紧凑",
  "settings.readingDensity.comfortable": "舒适",
  "settings.readingDensity.relaxed": "疏朗",
  "settings.highlightStrength": "高亮强度",
  "settings.highlightStrengthDesc": "调整批注高亮的显示强度。",
  "settings.highlightStrength.subtle": "轻",
  "settings.highlightStrength.balanced": "中",
  "settings.highlightStrength.strong": "强",
  "settings.localeZh": "中文",
  "settings.localeEn": "English",
  "settings.readingReset": "恢复阅读设置",
  "settings.saveError": "保存失败，请稍后重试。",
  "settings.promptsIntro": "reply / iterate 的提示头会写入 cliV 自己的配置文件。留空时回退到内置默认值。",
  "settings.promptsFieldDesc": "失焦后保存到 ~/.cliv/config.toml。",
  "settings.promptsDefaultLabel": "默认值",
  "settings.promptsReset": "恢复默认提示头",
  "settings.prompts.replyHeaderZh": "回复提示头（中文）",
  "settings.prompts.replyHeaderEn": "回复提示头（英文）",
  "settings.prompts.iterateHeaderZh": "迭代提示头（中文）",
  "settings.prompts.iterateHeaderEn": "迭代提示头（英文）",
  "settings.shortcutsIntro": "只管理 cliV 应用内支持的快捷命令，按键格式使用 Mod / Alt / Shift 组合，例如 Mod+Enter。",
  "settings.shortcuts.example": "默认值",
  "settings.shortcuts.invalid": "请输入有效快捷键，例如 Mod+O。",
  "settings.shortcutsReset": "恢复默认快捷键",
  "settings.shortcutsPriorityNote": "`submit_annotation` 与 `submit_return` 可以共用同一个键位。当前焦点在批注弹窗提交上下文时，批注提交优先；否则交给整体 return 提交。",
  "settings.shortcuts.openFile": "打开文件",
  "settings.shortcuts.openFileDesc": "打开本地 Markdown / 文本文件。",
  "settings.shortcuts.search": "搜索文档",
  "settings.shortcuts.searchDesc": "切换文内搜索输入框。",
  "settings.shortcuts.submitReturn": "提交整体返回",
  "settings.shortcuts.submitReturnDesc": "提交底部 return builder 中的整体反馈。",
  "settings.shortcuts.submitAnnotation": "提交批注",
  "settings.shortcuts.submitAnnotationDesc": "提交当前批注弹窗中的批注内容。",
  "settings.shortcuts.addAnnotation": "添加批注",
  "settings.shortcuts.addAnnotationDesc": "在已选中文本时直接打开批注弹窗。",
  "settings.shortcuts.fontIncrease": "放大字号",
  "settings.shortcuts.fontIncreaseDesc": "提高当前阅读字号。",
  "settings.shortcuts.fontDecrease": "缩小字号",
  "settings.shortcuts.fontDecreaseDesc": "降低当前阅读字号。",
  "settings.shortcuts.fontReset": "重置字号",
  "settings.shortcuts.fontResetDesc": "恢复默认阅读字号。",
  "settings.integrations.clivConfig": "cliV 配置文件",
  "settings.integrations.clivConfigExists": "当前已检测到 cliV 配置文件，后续设置会继续写入这里。",
  "settings.integrations.clivConfigPending": "当前还没有 cliV 配置文件；第一次保存设置时会自动创建。",
  "settings.integrations.uiFromConfig": "本次启动的 durable UI 设置已从 config 文件加载。",
  "settings.integrations.uiFromLegacy": "当前仍兼容旧 localStorage 偏好；一旦保存设置，就会迁移到统一 config。",
  "settings.integrations.agentBoundaryTitle": "外部 Agent Hook 边界",
  "settings.integrations.agentBoundaryDesc": "下面这些文件仍由各自的 agent CLI 管理。cliV 只展示边界，不会在这里直接改写它们。",

  // ── Annotation: Card ──
  "ann.edit": "编辑",
  "ann.delete": "删除",
  "ann.editTitle": "编辑",
  "ann.deleteTitle": "删除",

  // ── Annotation: relative time ──
  "time.justNow": "刚刚",
  "time.minutesAgo": "{n}分钟前",
  "time.hoursAgo": "{n}小时前",
  "time.daysAgo": "{n}天前",

  // ── Annotation: List ──
  "annList.hint": "选中文本后会直接弹出批注框",

  // ── Annotation: Popup ──
  "annPopup.comment": "批注",
  "annPopup.question": "提问",
  "annPopup.rewrite": "重写",
  "annPopup.challenge": "质疑",
  "annPopup.editPlaceholder": "编辑批注内容…",
  "annPopup.addPlaceholder": "添加批注…",
  "annPopup.submitHint": "Ctrl+Enter 提交",
  "annPopup.cancel": "取消",
  "annPopup.save": "保存",
  "annPopup.add": "添加批注",

  // ── Annotation: Floating Button ──
  "annBtn.add": "添加批注",

  // ── Annotation: Hover Actions ──
  "annHover.edit": "编辑",
  "annHover.delete": "删除",

  // ── ReturnBuilder ──
  "return.outputEditor": "输出编辑器",
  "return.annotationCount": "{n} 条批注",
  "return.replyMode": "回复模式",
  "return.replyDesc": "作为对话反馈返回当前会话",
  "return.iterateMode": "迭代编辑",
  "return.iterateDesc": "对同一文本反复修改完善",
  "return.freeEdit": "自由编辑（全文评论 / 额外指令）",
  "return.freeEditPlaceholder": "在此输入对整篇文档的评论、额外指令或修改要求…",
  "return.aggregatePreview": "批注聚合预览",
  "return.deselectAll": "取消",
  "return.selectAll": "全选",
  "return.noAnnotations": "暂无批注",
  "return.copied": "已复制到剪贴板",
  "return.written": "已写回，窗口即将关闭",
  "return.submittingCopy": "正在复制并归档…",
  "return.submittingWriteBack": "正在写回并归档…",
  "return.replyModeStatus": "回复模式",
  "return.iterateModeStatus": "迭代编辑模式",
  "return.selectedCount": " · {n} 条批注已选",
  "return.writeBackClose": "写回并关闭",
  "return.copySubmit": "复制并提交",
  "return.writeFail": "写回失败",

  // ── SessionTree ──
  "session.noHistory": "暂无历史会话",
  "session.saveHint": "保存批注后会在此处显示",
  "session.deleteTitle": "删除会话",

  // ── Language Switcher ──
  "lang.switch": "EN",

  // ── Prompt Output (sent to AI agents) ──
  "prompt.replyHeader": "请基于以下批注逐条回应。请以 Markdown 格式返回，除非我明确要求，不要重写未标注的部分。",
  "prompt.iterateHeader": "请根据以下批注，对原文进行增量修改。请以 Markdown 格式返回，保持未标注部分不变，仅修改被标注的内容。",
  "prompt.annotationHeading": "批注 {n}",
  "prompt.kindComment": "评论",
  "prompt.kindQuestion": "提问",
  "prompt.kindRewrite": "改写",
  "prompt.kindChallenge": "质疑",
  "prompt.type": "类型",
  "prompt.originalText": "原文",
  "prompt.lineNumber": " (第 {n} 行)",
  "prompt.lineRange": " (第 {n} 行)",
  "prompt.comment": "批注",
} as const;

const en: Record<keyof typeof zh, string> = {
  // ── App ──
  "app.loading": "Loading document...",
  "app.errorTitle": "Load Error",
  "app.errorHint": "Check the file path or use",
  "app.errorHintOpen": "to open",
  "app.readFileFail": "Failed to read file",

  // ── TopBar ──
  "topbar.collapseSidebar": "Collapse sidebar",
  "topbar.expandSidebar": "Expand sidebar",
  "topbar.openFile": "Open file (Ctrl+O)",
  "topbar.zoomOut": "Zoom out (Ctrl+-)",
  "topbar.zoomIn": "Zoom in (Ctrl+=)",

  // ── LeftSidebar ──
  "sidebar.outline": "Outline",
  "sidebar.history": "History",
  "sidebar.save": "Save",
  "sidebar.saveSession": "Save session",
  "history.searchPlaceholder": "Search history...",
  "history.noHistory": "No archived reviews yet",
  "history.emptyHint": "Submitted feedback will appear here grouped by workspace",
  "history.noMatch": "No matching history",
  "history.noMatchHint": "Try a different keyword",
  "history.loadError": "Failed to load history",
  "history.charsSuffix": " chars",
  "history.itemsSuffix": " items",
  "history.pathLabel": "Project path",
  "history.copyPath": "Copy path",
  "history.pathCopied": "Copied",
  "history.groupCount": "{n} items",
  "history.expandGroup": "Expand project",
  "history.collapseGroup": "Collapse project",
  "history.archivesTab": "Archived reviews",
  "history.sessionsTab": "Saved sessions",
  "history.readOnlyMode": "History Replay",
  "history.readOnlyBadge": "Viewing read-only archived review",
  "history.readOnlyHint": "You are viewing an archived snapshot for review only. Changes here will not write back to the source file.",

  // ── DocumentArea ──
  "docarea.hint": "or click the button below to open a file.",
  "docarea.hintUse": "Use",
  "docarea.openMarkdown": "Open Markdown File",

  // ── DocumentOutline ──
  "outline.noHeadings": "No headings",
  "outline.toc": "Contents",
  "outline.ariaLabel": "Document outline",

  // ── DocumentSearch ──
  "search.placeholder": "Search document...",
  "search.noResult": "No results",

  // ── ThemeSwitcher ──
  "theme.dark": "Dark",
  "theme.dim": "Dim",
  "theme.light": "Light",
  "theme.ariaLabel": "Theme switcher",

  // ── Settings ──
  "settings.open": "Settings",
  "settings.title": "Settings",
  "settings.subtitle": "Manage reading preferences, prompt headers, and supported app shortcuts in one place.",
  "settings.reset": "Reset",
  "settings.resetTitle": "Reset All Settings",
  "settings.resetDesc": "Restore all settings to their default values.",
  "settings.appearance": "Appearance",
  "settings.layout": "Layout",
  "settings.reading": "Reading",
  "settings.tab.reading": "Reading",
  "settings.tab.prompts": "Prompts",
  "settings.tab.shortcuts": "Shortcuts",
  "settings.tab.integrations": "Integrations",
  "settings.section.reading": "Reading",
  "settings.section.language": "Language",
  "settings.section.layout": "Layout",
  "settings.theme": "Theme",
  "settings.themeDesc": "Select the interface appearance theme.",
  "settings.fontSize": "Font size",
  "settings.fontSizeDesc": "Adjust the default text size for articles and notes.",
  "settings.language": "Language",
  "settings.languageDesc": "Select the interface display language.",
  "settings.sidebar": "Sidebar",
  "settings.sidebarDesc": "Control the default sidebar visibility.",
  "settings.sidebar.open": "Open",
  "settings.sidebar.closed": "Closed",
  "settings.sidebarTab": "Default tab",
  "settings.sidebarTabDesc": "Set the default sidebar tab.",
  "settings.contentWidth": "Content width",
  "settings.contentWidthDesc": "Control the maximum width of the reading area.",
  "settings.contentWidth.narrow": "Narrow",
  "settings.contentWidth.standard": "Standard",
  "settings.contentWidth.wide": "Wide",
  "settings.pagePadding": "Page padding",
  "settings.pagePaddingDesc": "Adjust the white space around page content.",
  "settings.pagePadding.compact": "Compact",
  "settings.pagePadding.comfortable": "Comfortable",
  "settings.pagePadding.airy": "Airy",
  "settings.readingDensity": "Reading density",
  "settings.readingDensityDesc": "Control the vertical spacing between lines of text.",
  "settings.readingDensity.compact": "Compact",
  "settings.readingDensity.comfortable": "Comfortable",
  "settings.readingDensity.relaxed": "Relaxed",
  "settings.highlightStrength": "Highlight strength",
  "settings.highlightStrengthDesc": "Adjust the intensity of annotation highlights.",
  "settings.highlightStrength.subtle": "Subtle",
  "settings.highlightStrength.balanced": "Balanced",
  "settings.highlightStrength.strong": "Strong",
  "settings.localeZh": "Chinese",
  "settings.localeEn": "English",
  "settings.readingReset": "Reset reading settings",
  "settings.saveError": "Save failed. Please try again.",
  "settings.promptsIntro": "Reply / iterate prompt headers are saved in cliV's own config file. Leave a field empty to fall back to the built-in default.",
  "settings.promptsFieldDesc": "Saved to ~/.cliv/config.toml when the field loses focus.",
  "settings.promptsDefaultLabel": "Default",
  "settings.promptsReset": "Restore default prompt headers",
  "settings.prompts.replyHeaderZh": "Reply header (Chinese)",
  "settings.prompts.replyHeaderEn": "Reply header (English)",
  "settings.prompts.iterateHeaderZh": "Iterate header (Chinese)",
  "settings.prompts.iterateHeaderEn": "Iterate header (English)",
  "settings.shortcutsIntro": "Only cliV-owned in-app commands are configurable here. Use Mod / Alt / Shift combinations such as Mod+Enter.",
  "settings.shortcuts.example": "Default",
  "settings.shortcuts.invalid": "Enter a valid shortcut such as Mod+O.",
  "settings.shortcutsReset": "Restore default shortcuts",
  "settings.shortcutsPriorityNote": "`submit_annotation` and `submit_return` may share the same key. When focus is inside the annotation submit context, annotation submit wins; otherwise the same key can fall through to return submit.",
  "settings.shortcuts.openFile": "Open file",
  "settings.shortcuts.openFileDesc": "Open a local Markdown or text file.",
  "settings.shortcuts.search": "Search document",
  "settings.shortcuts.searchDesc": "Toggle the in-document search box.",
  "settings.shortcuts.submitReturn": "Submit return",
  "settings.shortcuts.submitReturnDesc": "Submit the full return builder output.",
  "settings.shortcuts.submitAnnotation": "Submit annotation",
  "settings.shortcuts.submitAnnotationDesc": "Submit the active annotation popup.",
  "settings.shortcuts.addAnnotation": "Add annotation",
  "settings.shortcuts.addAnnotationDesc": "Open the annotation popup when text is selected.",
  "settings.shortcuts.fontIncrease": "Increase font size",
  "settings.shortcuts.fontIncreaseDesc": "Increase the current reading font size.",
  "settings.shortcuts.fontDecrease": "Decrease font size",
  "settings.shortcuts.fontDecreaseDesc": "Decrease the current reading font size.",
  "settings.shortcuts.fontReset": "Reset font size",
  "settings.shortcuts.fontResetDesc": "Restore the default reading font size.",
  "settings.integrations.clivConfig": "cliV config file",
  "settings.integrations.clivConfigExists": "cliV already has a config file on disk. Future settings changes continue to write there.",
  "settings.integrations.clivConfigPending": "cliV does not have a config file yet. It will be created on the first settings save.",
  "settings.integrations.uiFromConfig": "Durable UI settings for this launch came from the config file.",
  "settings.integrations.uiFromLegacy": "Legacy localStorage preferences are still honored for compatibility until the first save migrates them into the unified config.",
  "settings.integrations.agentBoundaryTitle": "External agent hook boundary",
  "settings.integrations.agentBoundaryDesc": "These files are still owned by their respective agent CLIs. cliV shows the boundary here but does not rewrite them directly.",

  // ── Annotation: Card ──
  "ann.edit": "Edit",
  "ann.delete": "Delete",
  "ann.editTitle": "Edit",
  "ann.deleteTitle": "Delete",

  // ── Annotation: relative time ──
  "time.justNow": "just now",
  "time.minutesAgo": "{n}m ago",
  "time.hoursAgo": "{n}h ago",
  "time.daysAgo": "{n}d ago",

  // ── Annotation: List ──
  "annList.hint": "Select text to open the annotation box instantly",

  // ── Annotation: Popup ──
  "annPopup.comment": "Comment",
  "annPopup.question": "Question",
  "annPopup.rewrite": "Rewrite",
  "annPopup.challenge": "Challenge",
  "annPopup.editPlaceholder": "Edit annotation…",
  "annPopup.addPlaceholder": "Add annotation…",
  "annPopup.submitHint": "Ctrl+Enter to submit",
  "annPopup.cancel": "Cancel",
  "annPopup.save": "Save",
  "annPopup.add": "Add Annotation",

  // ── Annotation: Floating Button ──
  "annBtn.add": "Annotate",

  // ── Annotation: Hover Actions ──
  "annHover.edit": "Edit",
  "annHover.delete": "Delete",

  // ── ReturnBuilder ──
  "return.outputEditor": "Output Editor",
  "return.annotationCount": "{n} annotations",
  "return.replyMode": "Reply",
  "return.replyDesc": "Return as dialogue feedback to current session",
  "return.iterateMode": "Iterate",
  "return.iterateDesc": "Iteratively refine the same text",
  "return.freeEdit": "Free Edit (global comments / extra instructions)",
  "return.freeEditPlaceholder": "Enter comments, extra instructions, or revision requests…",
  "return.aggregatePreview": "Annotation Preview",
  "return.deselectAll": "Deselect",
  "return.selectAll": "Select all",
  "return.noAnnotations": "No annotations",
  "return.copied": "Copied to clipboard",
  "return.written": "Written back, closing window",
  "return.submittingCopy": "Copying and saving…",
  "return.submittingWriteBack": "Writing back and saving…",
  "return.replyModeStatus": "Reply mode",
  "return.iterateModeStatus": "Iterate mode",
  "return.selectedCount": " · {n} selected",
  "return.writeBackClose": "Write back & close",
  "return.copySubmit": "Copy & submit",
  "return.writeFail": "Write-back failed",

  // ── SessionTree ──
  "session.noHistory": "No saved sessions",
  "session.saveHint": "Saved annotations will appear here",
  "session.deleteTitle": "Delete session",

  // ── Language Switcher ──
  "lang.switch": "中",

  // ── Prompt Output (sent to AI agents) ──
  "prompt.replyHeader": "Please respond to each annotation below. Please format your response in Markdown. Do not rewrite parts of the text that are not annotated unless explicitly requested.",
  "prompt.iterateHeader": "Please make incremental revisions to the original text based on the following annotations. Please format your response in Markdown, keep the unannotated parts unchanged and only modify the annotated content.",
  "prompt.annotationHeading": "Annotation {n}",
  "prompt.kindComment": "Comment",
  "prompt.kindQuestion": "Question",
  "prompt.kindRewrite": "Rewrite",
  "prompt.kindChallenge": "Challenge",
  "prompt.type": "Type",
  "prompt.originalText": "Original Text",
  "prompt.lineNumber": " (Line {n})",
  "prompt.lineRange": " (Lines {n})",
  "prompt.comment": "Annotation",
};

export const messages: Record<Locale, Record<string, string>> = { zh, en };

/**
 * Detect initial locale from browser settings.
 * Returns 'zh' if browser language starts with 'zh', otherwise 'en'.
 */
export function detectLocale(): Locale {
  try {
    const lang = navigator.language || "";
    return lang.startsWith("zh") ? "zh" : "en";
  } catch {
    return "en";
  }
}

/**
 * Detect locale based on content text (e.g. document body or annotations).
 * If the text contains a significant amount of Chinese characters, returns 'zh'.
 * Otherwise returns 'en'.
 */
export function detectContentLocale(text: string): Locale {
  if (!text) return "en";
  // Match Chinese characters (using explicit unicode ranges to avoid TS target issues)
  const match = text.match(/[\u4e00-\u9fa5]/g);
  if (!match) return "en";
  
  // If > 2% of the text are Chinese characters, consider it Chinese content.
  // This helps avoid false positives from a single stray character in a large English text.
  const hanRatio = match.length / text.length;
  return hanRatio > 0.02 ? "zh" : "en";
}
