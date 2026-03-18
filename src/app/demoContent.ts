export const DEMO_CONTENT_ZH = `# cliV v0.2

> AI 长回复审阅器 — 选区批注 · 多批注聚合 · 写回当前线程

## 功能状态

| 功能 | 状态 |
|---|---|
| Markdown 渲染 | ✅ 就绪 |
| Mermaid 图表 | ✅ 就绪 |
| 目录导航 | ✅ 就绪 |
| 文档搜索 | ✅ Ctrl+F |
| 主题切换 | ✅ Dark/Dim/Light |
| 字体缩放 | ✅ Ctrl+=/Ctrl-/Ctrl+0 |
| 全屏预览 | ✅ 就绪 |
| 选区批注 | ✅ 就绪 |
| 聚合回写 | ✅ 就绪 |

## 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS v4
- **状态**: Zustand
- **后端**: Tauri v2 (Rust)
- **测试**: Vitest

## 示例代码

\`\`\`typescript
// Zustand store 示例
export const useUIStore = create<UIState>((set) => ({
  theme: "dark",
  fontSize: 18,
  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
}));
\`\`\`

## 架构图

\`\`\`mermaid
graph LR
    A[CLI] --> B[Tauri v2]
    B --> C[React 19]
    C --> D[MarkdownViewer]
    C --> E[AnnotationSystem]
    C --> F[ReturnBuilder]
    D --> G[Mermaid]
    D --> H[react-markdown]
\`\`\`

## 设计令牌验证

这段文字使用 \`--text-primary\` 颜色。

**加粗文字** 使用 \`--text-strong\` 颜色。

*这段斜体* 测试排版。

## 图片测试

点击图片可全屏查看：

![风景示例](https://picsum.photos/id/10/800/400)

并排小图：

| 图片 A | 图片 B |
|---|---|
| ![样例A](https://picsum.photos/id/20/300/200) | ![样例B](https://picsum.photos/id/30/300/200) |

---

### 列表测试

1. 第一项：支持有序列表
2. 第二项：正确缩进
3. 第三项：间距合理

- 无序列表项 A
- 无序列表项 B
  - 嵌套项 B.1
  - 嵌套项 B.2

### 引用测试

> 批注是对文档内容的局部评价，一条批注通常包含：
> 被引用的原文片段、用户的批注文字、批注类型。

### 长文档性能测试

${"以下是填充内容用于验证长文档渲染性能。cliV 设计为处理超过 1000 行的 Markdown 文档。每段文本确保渲染器不会出现卡顿或延迟。\\n\\n".repeat(20)}
`;

export const DEMO_CONTENT_EN = `# cliV v0.2

> AI Long Reply Reviewer — Selection Annotation · Aggregated Writeback · Return to Thread

## Feature Status

| Feature | Status |
|---|---|
| Markdown Rendering | ✅ Ready |
| Mermaid Diagrams | ✅ Ready |
| Outline Navigation | ✅ Ready |
| Document Search | ✅ Ctrl+F |
| Theme Switcher | ✅ Dark/Dim/Light |
| Font Zooming | ✅ Ctrl+=/Ctrl-/Ctrl+0 |
| Fullscreen Preview | ✅ Ready |
| Selection Annotation | ✅ Ready |
| Aggregated Writeback | ✅ Ready |

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS v4
- **State**: Zustand
- **Backend**: Tauri v2 (Rust)
- **Testing**: Vitest

## Example Code

\`\`\`typescript
// Zustand store example
export const useUIStore = create<UIState>((set) => ({
  theme: "dark",
  fontSize: 18,
  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
}));
\`\`\`

## Architecture Diagram

\`\`\`mermaid
graph LR
    A[CLI] --> B[Tauri v2]
    B --> C[React 19]
    C --> D[MarkdownViewer]
    C --> E[AnnotationSystem]
    C --> F[ReturnBuilder]
    D --> G[Mermaid]
    D --> H[react-markdown]
\`\`\`

## Design Tokens Validation

This text uses the \`--text-primary\` color.

**Bold text** uses the \`--text-strong\` color.

*This italic text* tests typography.

## Image Tests

Click any image to view fullscreen:

![Landscape example](https://picsum.photos/id/10/800/400)

Side-by-side thumbnails:

| Image A | Image B |
|---|---|
| ![Sample A](https://picsum.photos/id/20/300/200) | ![Sample B](https://picsum.photos/id/30/300/200) |

---

### List Tests

1. First item: Ordered list support
2. Second item: Correct indentation
3. Third item: Reasonable spacing

- Unordered item A
- Unordered item B
  - Nested item B.1
  - Nested item B.2

### Blockquote Tests

> An annotation is a local evaluation of document content. It typically includes:
> the quoted original text fragment, the user's annotation text, and the annotation type.

### Long Document Performance Tests

${"The following is placeholder content used to verify long document rendering performance. cliV is designed to handle Markdown documents exceeding 1000 lines. Each paragraph ensures the renderer will not stutter or lag.\\n\\n".repeat(20)}
`;
