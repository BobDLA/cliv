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
  "app.exitFullscreen": "退出全屏 (Esc)",

  // ── TopBar ──
  "topbar.collapseSidebar": "收起侧栏",
  "topbar.expandSidebar": "展开侧栏",
  "topbar.openFile": "打开文件 (Ctrl+O)",
  "topbar.zoomOut": "缩小 (Ctrl+-)",
  "topbar.zoomIn": "放大 (Ctrl+=)",
  "topbar.fullscreen": "全屏预览",

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
  "history.charsSuffix": "字",
  "history.itemsSuffix": "条",
  "history.readOnlyBadge": "当前正在查看只读历史归档",

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
  "app.exitFullscreen": "Exit fullscreen (Esc)",

  // ── TopBar ──
  "topbar.collapseSidebar": "Collapse sidebar",
  "topbar.expandSidebar": "Expand sidebar",
  "topbar.openFile": "Open file (Ctrl+O)",
  "topbar.zoomOut": "Zoom out (Ctrl+-)",
  "topbar.zoomIn": "Zoom in (Ctrl+=)",
  "topbar.fullscreen": "Fullscreen preview",

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
  "history.charsSuffix": " chars",
  "history.itemsSuffix": " items",
  "history.readOnlyBadge": "Viewing read-only archived review",

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
