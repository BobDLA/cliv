# cliV — Architecture & Feature Showcase

> **A desktop reviewer launched from the CLI, for reading long AI agent replies and Markdown drafts.**

This document presents a comprehensive walkthrough of cliV's internal architecture, data flows, and feature set. It is intended to demonstrate the project's rendering capabilities—including headings, rich text, Mermaid diagrams, code blocks, tables, blockquotes, and more.

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Agent Integration Pipeline](#agent-integration-pipeline)
4. [CLI Parsing & Mode Dispatch](#cli-parsing--mode-dispatch)
5. [Reply Caching Subsystem](#reply-caching-subsystem)
6. [Agent Detection Algorithm](#agent-detection-algorithm)
7. [Frontend Architecture](#frontend-architecture)
8. [State Management Deep Dive](#state-management-deep-dive)
9. [Annotation Workflow](#annotation-workflow)
10. [Review History](#review-history)
11. [Write-back & Return Flow](#write-back--return-flow)
12. [Data Model Reference](#data-model-reference)
13. [Security & Reliability](#security--reliability)
14. [Roadmap & Vision](#roadmap--vision)

---

## Overview

AI coding agents like **Codex**, **Claude Code**, and **Gemini CLI** produce long, structured replies—but you're reading them in a terminal. That's fine for 20 lines, painful for 500+.

**cliV** bridges this gap by acting as a desktop-grade Markdown reviewer that integrates seamlessly into the agent's `$EDITOR` flow:

| Capability | Description |
|:---|:---|
| 📖 Rich Rendering | Headings, code blocks, tables, Mermaid diagrams |
| ✏️ Annotations | Select exact passages, add inline comments |
| 📋 Write-back | Aggregate annotations → write back or copy |
| 🔄 Multi-agent | Auto-detect Codex / Claude / Gemini |
| 🗂️ Sessions | Persist review snapshots locally |
| 🎛️ Reading Settings | One surface for theme, font size, layout memory, and reading presets |

### Design Philosophy

> *"The right tool for reading should be as powerful as the tool that wrote it."*

cliV follows three core principles:

1. **Zero-friction integration** — drop-in `$EDITOR` replacement, no configuration files needed
2. **Defensive reliability** — atomic writes, graceful fallbacks, defensive error handling
3. **Agent-aware intelligence** — auto-detects which agent launched it and finds the correct reply

---

## System Architecture

The application is split into a **Rust backend** (Tauri v2) and a **React frontend**, communicating via Tauri's IPC bridge.

### High-Level Component Diagram

```mermaid
graph TB
    subgraph "Agent Ecosystem"
        CODEX["🤖 OpenAI Codex"]
        CLAUDE["🤖 Claude Code"]
        GEMINI["🤖 Gemini CLI"]
    end

    subgraph "Rust Backend (Tauri v2)"
        CLI["CLI Parser<br/>cli.rs"]
        CACHE["Cache Manager<br/>cache.rs"]
        DETECT["Agent Detector"]
        EXTRACT["Reply Extractors"]
        CMD_FILES["File Commands"]
        CMD_SESS["Session Commands"]
    end

    subgraph "React Frontend"
        APP["App Shell"]
        DOC["Document Viewer"]
        ANN["Annotation Layer"]
        RET["Return Flow"]
        SESS["Session Manager"]
    end

    subgraph "Storage"
        FS_CACHE["~/.codex/reply_cache<br/>~/.claude/reply_cache<br/>~/.gemini/reply_cache"]
        FS_SESS["~/.cliv/sessions"]
        FS_ANN["~/.cliv/annotations"]
        CLIPBOARD["System Clipboard"]
    end

    CODEX -->|"notify hook"| CLI
    CLAUDE -->|"Stop hook (stdin)"| CLI
    GEMINI -->|"AfterAgent hook (stdin)"| CLI

    CLI --> CACHE
    CLI --> DETECT
    DETECT --> EXTRACT
    EXTRACT --> CMD_FILES

    CMD_FILES <-->|"IPC"| DOC
    CMD_SESS <-->|"IPC"| SESS
    CACHE --> FS_CACHE
    CMD_SESS --> FS_SESS

    DOC --> ANN
    ANN --> RET
    RET -->|"write-back"| CMD_FILES
    RET -->|"fallback"| CLIPBOARD
```

### Layer Responsibilities

```mermaid
graph LR
    subgraph "Layer 1: CLI Entry"
        A1["Argument Parsing"]
        A2["Mode Dispatch"]
        A3["Env Detection"]
    end

    subgraph "Layer 2: Core Services"
        B1["Agent Detection"]
        B2["Reply Extraction"]
        B3["Cache Read/Write"]
        B4["File I/O"]
    end

    subgraph "Layer 3: IPC Bridge"
        C1["Tauri Commands"]
        C2["Event System"]
    end

    subgraph "Layer 4: UI Layer"
        D1["Document Rendering"]
        D2["Annotation System"]
        D3["Session UI"]
        D4["Theme Engine"]
    end

    A1 --> A2
    A2 --> A3
    A3 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> B4
    B4 --> C1
    C1 --> C2
    C2 --> D1
    D1 --> D2
    D2 --> D3
    D3 --> D4
```

---

## Agent Integration Pipeline

Each supported AI agent has a unique hook mechanism. cliV normalizes these into a unified cache format.

### Hook Configuration Matrix

| Agent | Hook Type | Trigger | Data Source | Cache Key |
|:---|:---|:---|:---|:---|
| Codex | `notify` | `agent-turn-complete` | CLI argument (JSON) | `thread_id` + PID |
| Claude Code | `Stop` | `Stop` event | stdin (JSON) | `session_id` + PID |
| Gemini CLI | `AfterAgent` | After agent response | stdin (JSON) | `GEMINI_SESSION_ID` + PID |

### Integration Setup Examples

**Codex** — Add to `~/.codex/config.yaml`:

```yaml
notify:
  - "cliv cache-codex '$1'"
```

**Claude Code** — Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cliv cache-claude"
          }
        ]
      }
    ]
  }
}
```

**Gemini CLI** — Add to `~/.gemini/settings.json`:

```json
{
  "hooks": {
    "AfterAgent": [
      {
        "cwd": ".",
        "command": "cliv cache-gemini"
      }
    ]
  }
}
```

---

## CLI Parsing & Mode Dispatch

cliV uses a hand-rolled CLI parser (no external crate dependencies) to keep the binary small and startup fast.

### Mode Decision Tree

```mermaid
flowchart TD
    START["cliV invoked"] --> CHECK_SUB{"argv[1] is<br/>subcommand?"}

    CHECK_SUB -->|"cache-codex"| CODEX_CACHE["CacheCodex Mode<br/>Parse JSON arg"]
    CHECK_SUB -->|"cache-claude"| CLAUDE_CACHE["CacheClaude Mode<br/>Read stdin"]
    CHECK_SUB -->|"cache-gemini"| GEMINI_CACHE["CacheGemini Mode<br/>Read stdin"]
    CHECK_SUB -->|"No"| GUI_MODE["GUI Mode"]

    GUI_MODE --> DETECT["detect_agent()"]
    DETECT --> PARSE_ARGS["Parse remaining args:<br/>--compose, --metadata, file"]

    CODEX_CACHE --> EXIT_0["Exit 0"]
    CLAUDE_CACHE --> EXIT_0
    GEMINI_CACHE --> EXIT_0
    PARSE_ARGS --> LAUNCH["Launch Tauri Window"]

    style CODEX_CACHE fill:#e8f5e9
    style CLAUDE_CACHE fill:#e3f2fd
    style GEMINI_CACHE fill:#fff3e0
    style GUI_MODE fill:#f3e5f5
```

### CLI Data Structures

```rust
/// How cliV was invoked.
#[derive(Debug, Clone)]
pub enum CliMode {
    /// Launch the Tauri GUI (default).
    Gui,
    /// Cache a Codex reply: `cliv cache-codex '<json>'`
    CacheCodex(String),
    /// Cache a Claude reply (stdin): `cliv cache-claude`
    CacheClaude,
    /// Cache a Gemini reply (stdin): `cliv cache-gemini`
    CacheGemini,
}

/// CLI arguments for GUI mode.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliArgs {
    pub compose_path: Option<String>,
    pub metadata_path: Option<String>,
    pub file_path: Option<String>,
    pub agent: Option<String>,
}
```

### Argument Parsing Logic

```rust
// Parse positional and named arguments
let mut i = 1;
while i < argv.len() {
    match argv[i].as_str() {
        "--metadata" => {
            args.metadata_path = Some(argv[i + 1].clone());
            i += 2;
        }
        "--compose" => {
            args.compose_path = Some(argv[i + 1].clone());
            i += 2;
        }
        arg if !arg.starts_with('-') => {
            // First positional arg = file path
            if args.file_path.is_none() {
                args.file_path = Some(arg.to_string());
                // Also set as compose target if not explicit
                if args.compose_path.is_none() {
                    args.compose_path = Some(arg.to_string());
                }
            }
            i += 1;
        }
        _ => { i += 1; }
    }
}
```

---

## Reply Caching Subsystem

The cache system ensures that agent replies survive the transition between the hook (headless) and the GUI (interactive) phases.

### Cache Write Flow (Atomic)

```mermaid
flowchart LR
    INPUT["Agent Reply<br/>(Markdown string)"] --> WRITE_TMP["Write to<br/>path.md.tmp"]
    WRITE_TMP --> RENAME["Rename to<br/>path.md"]
    RENAME --> SUCCESS["✅ Cache written"]

    WRITE_TMP -->|"write fails"| LOG_ERR1["⚠️ Log error"]
    RENAME -->|"rename fails"| CLEANUP["Remove .tmp"]
    CLEANUP --> LOG_ERR2["⚠️ Log error"]

    style SUCCESS fill:#c8e6c9
    style LOG_ERR1 fill:#ffcdd2
    style LOG_ERR2 fill:#ffcdd2
```

### Atomic Write Implementation

```rust
/// Atomic write: write to .tmp then rename.
fn atomic_write_cache(path: &PathBuf, content: &str) {
    let tmp = path.with_extension("md.tmp");

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if fs::write(&tmp, content).is_ok() {
        if fs::rename(&tmp, path).is_ok() {
            log(&format!("  cache: wrote {} bytes → {}",
                content.len(), path.display()));
        } else {
            log(&format!("  cache: rename failed for {}",
                path.display()));
            let _ = fs::remove_file(&tmp);
        }
    } else {
        log(&format!("  cache: write failed for {}",
            tmp.display()));
    }
}
```

### Cache Directory Layout

```
~/.codex/
└── reply_cache/
    ├── <agent_pid>.md        # Indexed by process PID
    └── <agent_pid>.meta.json # Stores the real Codex thread ID

~/.claude/
└── reply_cache/
    ├── <session_id>.md       # Indexed by Claude session ID
    └── <agent_pid>.md        # Indexed by process PID

~/.gemini/
└── reply_cache/
    ├── <session_id>.md       # Indexed by Gemini session ID
    └── <agent_pid>.md        # Indexed by process PID
```

### Codex PID-Key Cache Strategy

Codex writes reply content under a single pid-keyed cache file and stores the real thread ID in the sidecar metadata file:

```mermaid
graph TD
    REPLY["Codex Reply"] --> PID["Keyed by Agent PID"]
    REPLY --> META["Sidecar Metadata"]

    PID --> CACHE["reply_cache/&lt;agent_pid&gt;.md"]
    META --> METAJSON["reply_cache/&lt;agent_pid&gt;.meta.json<br/>real_session_id = thread-id"]

    CACHE --> LOOKUP1["GUI reads by pid cache key<br/>(when available)"]
    METAJSON --> LOOKUP2["GUI maps thread-id → newest pid cache"]

    style PID fill:#fff3e0
    style META fill:#e3f2fd
```

Claude and Gemini still keep both session-id and pid-keyed cache files.

> **Why pid + metadata for Codex?** The pid-keyed cache gives cliV a deterministic lookup key during GUI launch, while the sidecar metadata preserves the real thread ID for SQLite-based recovery.

---

## Agent Detection Algorithm

cliV auto-detects which AI agent launched it using a cascading strategy that inspects environment variables and the process tree.

### Detection Priority Chain

```mermaid
flowchart TD
    START["detect_agent()"] --> ENV_OVERRIDE{"CLIV_AGENT<br/>env var set?"}
    ENV_OVERRIDE -->|"Yes"| USE_OVERRIDE["Use override value<br/>(codex | claude | gemini)"]
    ENV_OVERRIDE -->|"No"| CHECK_CODEX{"CODEX_THREAD_ID<br/>set?"}

    CHECK_CODEX -->|"Yes"| CODEX["→ codex"]
    CHECK_CODEX -->|"No"| CHECK_CLAUDE{"CLAUDE_SESSION_ID<br/>set?"}

    CHECK_CLAUDE -->|"Yes"| CLAUDE["→ claude"]
    CHECK_CLAUDE -->|"No"| CHECK_GEMINI{"GEMINI_SESSION_ID<br/>set?"}

    CHECK_GEMINI -->|"Yes"| GEMINI["→ gemini"]
    CHECK_GEMINI -->|"No"| PROC_TREE["Walk parent<br/>process tree"]

    PROC_TREE --> SCAN{"Scan up to 5<br/>ancestor processes"}
    SCAN -->|"Found match"| MATCHED["Return matched agent<br/>+ set session env var"]
    SCAN -->|"No match"| NONE["→ None (unknown)"]

    style USE_OVERRIDE fill:#e8f5e9
    style CODEX fill:#e3f2fd
    style CLAUDE fill:#f3e5f5
    style GEMINI fill:#fff3e0
    style NONE fill:#ffcdd2
```


### Cross-Platform Implementation

```rust
// Linux: uses /proc filesystem
#[cfg(target_os = "linux")]
fn detect_agent_from_parent_process() -> Option<String> {
    let mut pid = std::os::unix::process::parent_id();
    for level in 0..5 {
        if pid <= 1 { break; }
        let comm = std::fs::read_to_string(
            format!("/proc/{}/comm", pid)
        )?.trim().to_lowercase();
        if let Some(agent) = match_agent_name(&comm) {
            return handle_agent_match(agent, pid, level);
        }
        // Walk up via /proc/PID/stat → PPID
        pid = extract_ppid_from_stat(pid)?;
    }
    None
}

// macOS: uses libproc + ps
#[cfg(target_os = "macos")]
fn detect_agent_from_parent_process() -> Option<String> {
    // Uses proc_name() FFI + `ps -o ppid=`
    // ...
}

// Windows: uses ToolHelp32 API snapshot
#[cfg(target_os = "windows")]
fn detect_agent_from_parent_process() -> Option<String> {
    // Uses CreateToolhelp32Snapshot + Process32FirstW
    // Builds full PID → (name, ppid) map, then walks
    // ...
}
```

---

## Frontend Architecture

The React frontend is organized into feature modules with a shared state layer.

### Module Dependency Graph

```mermaid
graph TB
    subgraph "Entry Point"
        MAIN["main.tsx"]
    end

    subgraph "App Shell (src/app/)"
        APP_COMP["App Component"]
        HOOKS["Custom Hooks"]
        LAYOUT["Layout Components"]
    end

    subgraph "Feature Modules (src/features/)"
        F_DOC["📄 documents/"]
        F_ANN["✏️ annotations/"]
        F_RET["📋 return/"]
        F_HIS["🗂️ history/"]
    end

    subgraph "Services (src/services/)"
        SVC_IPC["tauriIpc.ts"]
        SVC_WB["writeBack.ts"]
        SVC_HIS["historyService.ts"]
        SVC_SESS["sessionService.ts"]
        SVC_SNAP["reviewSnapshot.ts"]
    end

    subgraph "State (src/stores/)"
        S_DOC["documentStore"]
        S_ANN["annotationStore"]
        S_SEL["selectionStore"]
        S_RET["returnStore"]
        S_SESS["sessionStore"]
        S_UI["uiStore"]
    end

    MAIN --> APP_COMP
    APP_COMP --> LAYOUT
    APP_COMP --> HOOKS

    LAYOUT --> F_DOC
    LAYOUT --> F_ANN
    LAYOUT --> F_RET
    LAYOUT --> F_SESS

    F_DOC --> S_DOC
    F_DOC --> SVC_IPC
    F_ANN --> S_ANN
    F_ANN --> S_SEL
    F_RET --> S_RET
    F_SESS --> S_SESS
    F_SESS --> SVC_SESS
    F_SESS --> SVC_SNAP

    SVC_IPC --> S_DOC
    SVC_WB --> S_RET
    SVC_SESS --> S_SESS
    SVC_SNAP --> S_DOC
    SVC_SNAP --> S_ANN
    SVC_SNAP --> S_SEL
    SVC_SNAP --> S_RET

    style F_DOC fill:#e3f2fd
    style F_ANN fill:#e8f5e9
    style F_RET fill:#fff3e0
    style F_SESS fill:#f3e5f5
```

### Component Tree

```mermaid
graph TD
    APP["App"] --> TOOLBAR["Toolbar"]
    APP --> SPLIT["Split View"]
    APP --> STATUS["Status Bar"]

    SPLIT --> DOC_PANEL["Document Panel"]
    SPLIT --> SIDE_PANEL["Side Panel"]

    DOC_PANEL --> MD_RENDERER["Markdown Renderer<br/>(react-markdown)"]
    DOC_PANEL --> HIGHLIGHT["Highlight Overlay<br/>(CSS Highlight API)"]
    DOC_PANEL --> BUBBLE["ParagraphBubble<br/>(annotation triggers)"]

    MD_RENDERER --> MERMAID["Mermaid Diagrams"]
    MD_RENDERER --> CODE_BLOCK["Code Highlight"]
    MD_RENDERER --> TABLE["Table Renderer"]

    SIDE_PANEL --> ANN_LIST["Annotation List"]
    SIDE_PANEL --> SESS_LIST["Session List"]
    SIDE_PANEL --> OVERVIEW["Overview Panel"]

    ANN_LIST --> ANN_CARD["Annotation Card"]
    ANN_CARD --> ANN_EDITOR["Inline Editor"]

    TOOLBAR --> THEME_BTN["Theme Switch"]
    TOOLBAR --> FONT_BTN["Font Scale"]
    TOOLBAR --> WRITE_BTN["Write Back"]
    TOOLBAR --> COPY_BTN["Copy Result"]
```

---

## State Management Deep Dive

cliV uses **Zustand** for state management with 6 independent stores, each responsible for a single domain.

### Store Topology

```mermaid
graph LR
    subgraph "Zustand Stores"
        DS["documentStore<br/>📄 Content + Paths"]
        AS["annotationStore<br/>✏️ Annotations"]
        SS["selectionStore<br/>🔍 Text Selection"]
        RS["returnStore<br/>📋 Write-back"]
        SES["sessionStore<br/>🗂️ Sessions"]
        HS["historyStore<br/>🗃️ Archive Replay"]
        UI["uiStore<br/>🎨 Theme + UI"]
    end

    SNAP["reviewSnapshot.ts<br/>restore seam"]

    DS -->|"content drives"| AS
    AS -->|"annotations feed"| RS
    SS -->|"selection creates"| AS
    SES -->|"loads saved session"| SNAP
    HS -->|"loads archive replay"| SNAP
    SNAP -->|"apply editable / replay snapshot"| DS
    SNAP -->|"apply annotation state"| AS
    SNAP -->|"replay reset only"| SS
    SNAP -->|"replay reset only"| RS
    UI -->|"theme/scale"| DS
```

### Document Store

```typescript
interface DocumentState {
  replyContent: string | null;    // The agent's reply (Markdown)
  composeContent: string | null;  // Editor compose content
  composePath: string | null;     // File path for write-back
  replyPath: string | null;       // Path to cached reply
  documentId: string;             // Unique document identifier
  isLoading: boolean;
  error: string | null;

  setDocument: (opts: {
    reply?: string | null;
    compose?: string | null;
    composePath?: string | null;
    replyPath?: string | null;
    documentId?: string;
  }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}
```

### Annotation Store

```typescript
interface AnnotationState {
  annotations: Annotation[];
  activeAnnotationId: string | null;
  hoveredAnnotationId: string | null;
  editingAnnotationId: string | null;

  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  setActiveAnnotation: (id: string | null) => void;
  setHoveredAnnotation: (id: string | null) => void;
  setEditingAnnotation: (id: string | null) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  clearAnnotations: () => void;
}
```

### State Persistence Strategy

```mermaid
flowchart LR
    UI["uiStore persistence"] -->|"serialize"| LS_UI["localStorage<br/>(prefix: cliv:)"]
    LS_UI -->|"hydrate on load"| UI

    SESS["sessionService"] -->|"saved session snapshots"| LS_SESS["localStorage<br/>(cliv-sessions)"]
    HIST["historyService"] -->|"archive summaries + payloads"| FS["~/.cliv/history/archive/"]

    LS_SESS -->|"editable restore"| SNAP["reviewSnapshot<br/>restore seam"]
    FS -->|"read-only replay restore"| SNAP
    SNAP -->|"apply snapshot"| ZUSTAND["document / annotation / selection / return stores"]
```

---

## Annotation Workflow

The annotation system is the heart of cliV's review experience. It allows users to highlight passages and attach contextual comments.

### Annotation Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Idle: App loaded

    Idle --> Selecting: User selects text
    Selecting --> Creating: Popup opens immediately
    Creating --> Saved: User types comment
    Creating --> Idle: Explicit close / cancel / Escape
    Saved --> Idle: Submit annotation
    Saved --> Saved: Reselect or copy elsewhere while popup stays open

    Saved --> Hovering: Mouse enters highlight
    Hovering --> Active: Click on highlight
    Active --> Editing: Double-click to edit
    Active --> Idle: Click away

    Saved --> Deleting: User deletes
    Deleting --> Idle: Annotation removed

    Active --> Aggregating: Write back triggered
    Aggregating --> [*]: Annotations to prompt
```

### Selection-to-Annotation Flow

```mermaid
sequenceDiagram
    participant User
    participant DOM as DOM Selection API
    participant SEL as selectionStore
    participant POP as AnnotationPopup
    participant ANN as annotationStore
    participant HL as CSS Highlight API

    User->>DOM: Select text passage
    DOM->>SEL: selectionChange + mouseup
    SEL->>SEL: Store range + text + position
    SEL->>POP: Open create popup immediately
    POP->>User: Focus textarea

    User->>POP: Type comment draft
    POP->>SEL: Persist draftComment in selectionStore

    User->>DOM: Select or copy another passage
    DOM->>SEL: selectionChange + mouseup
    SEL->>SEL: Ignore reselection while popup is open

    User->>POP: Submit annotation explicitly
    POP->>ANN: addAnnotation with stored selection + draft
    ANN->>HL: Create CSS Highlight
    HL->>DOM: Apply highlight pseudo-element

    Note over User,DOM: Highlight is now visible with hover and click interactions
```

### Annotation Data Model

```typescript
interface Annotation {
  id: string;                  // UUID
  selectedText: string;        // The highlighted passage
  comment: string;             // User's annotation comment
  paragraphIndex: number;      // Which paragraph the selection is in
  startOffset: number;         // Character offset within paragraph
  endOffset: number;           // Character offset within paragraph
  createdAt: number;           // Timestamp (ms)
  color?: string;              // Highlight color (optional)
}
```

### Annotation Aggregation for Write-back

When the user triggers "Write back", all annotations are aggregated into a structured prompt:

```markdown
## Review Annotations

### Annotation 1
> Selected text: "The function uses a recursive approach..."
**Comment:** Consider using an iterative approach for better
stack safety with large inputs.

### Annotation 2
> Selected text: "Error handling is deferred to the caller..."
**Comment:** We should handle the FileNotFound case explicitly
here rather than propagating it.

### Annotation 3
> Selected text: "The cache is stored in memory..."
**Comment:** Should we add an LRU eviction policy for
long-running sessions?
```

---

## Review History

Submitted reviews are archived per workspace and can later be replayed as read-only review scenes.

### Session State Machine

```mermaid
stateDiagram-v2
    [*] --> Reviewing: App starts with review content

    Reviewing --> Submitting: User clicks Submit
    Submitting --> Archived: Submission succeeds
    Archived --> Reviewing: User keeps working on current document
    Archived --> [*]: Close app

    Reviewing --> Replay: User opens archived history entry
    Replay --> Reviewing: User opens a live document again
```

### Session Data Structure

```mermaid
classDiagram
    class ReviewArchive {
        +String id
        +String workspacePath
        +String archivedAt
        +DocumentSnapshot reply
        +Annotation[] annotations
        +Submission submission
    }

    class DocumentSnapshot {
        +String replyContent
        +String reviewPath
        +String replyPath
        +String workspacePath
    }

    class Annotation {
        +String id
        +String selectedText
        +String comment
        +Number paragraphIndex
        +Number startOffset
        +Number endOffset
    }

    class Submission {
        +String method
        +String templateMode
        +String userText
        +String finalOutput
    }

    ReviewArchive *-- DocumentSnapshot
    ReviewArchive *-- Annotation
    ReviewArchive *-- Submission
```

### Archive Storage Flow

```mermaid
sequenceDiagram
    participant UI as React UI
    participant Store as historyStore
    participant SVC as historyService
    participant Restore as reviewSnapshot
    participant IPC as Tauri IPC
    participant FS as History Archive

    Note over UI: User clicks Submit
    UI->>Store: gather current reply + annotations + submission payload
    Store->>SVC: saveReviewArchive snapshot
    SVC->>IPC: invoke save_review_archive with data
    IPC->>FS: atomic_write archive files
    FS-->>IPC: OK
    IPC-->>SVC: OK
    SVC-->>Store: Updated
    Store-->>UI: Re-render grouped history list

    Note over UI: Later the user clicks an archived review
    UI->>Store: loadReviewArchive workspace + archive id
    Store->>SVC: loadReviewArchive
    SVC->>IPC: invoke load_review_archive
    IPC->>FS: read reply.md + annotations.json + submission.json
    FS-->>IPC: Archive snapshot
    IPC-->>SVC: ReviewArchive object
    SVC-->>Store: ReviewArchive object
    Store->>Restore: buildArchiveReviewSnapshot + applyReviewSnapshot
    Restore-->>Store: Read-only replay stores updated
    Store-->>UI: Re-render everything
```

Saved local sessions use the same restore seam, but keep `localStorage` persistence and editable document state.

---

## Write-back & Return Flow

The return flow aggregates annotations into actionable feedback and delivers it back to the agent.

### Write-back Decision Tree

```mermaid
flowchart TD
    START["User triggers<br/>Write Back"] --> HAS_COMPOSE{"composePath<br/>exists?"}

    HAS_COMPOSE -->|"Yes"| HAS_TAURI{"Running in<br/>Tauri?"}
    HAS_COMPOSE -->|"No"| CLIPBOARD["📋 Copy to clipboard"]

    HAS_TAURI -->|"Yes"| WRITE_FILE["Write to composePath<br/>(atomic write)"]
    HAS_TAURI -->|"No"| CLIPBOARD

    WRITE_FILE --> CLOSE["Close window<br/>(agent resumes)"]
    CLIPBOARD --> NOTIFY["Show notification:<br/>'Copied to clipboard'"]

    style WRITE_FILE fill:#c8e6c9
    style CLIPBOARD fill:#fff3e0
    style CLOSE fill:#e8f5e9
    style NOTIFY fill:#e3f2fd
```

### Return Content Assembly

```mermaid
flowchart LR
    ANN["All Annotations"] --> SORT["Sort by<br/>paragraph order"]
    SORT --> FORMAT["Format each as<br/>quote + comment"]
    FORMAT --> HEADER["Add review header"]
    HEADER --> MERGE["Merge into<br/>single Markdown"]
    MERGE --> OUTPUT["Final prompt<br/>for agent"]
```

---

## Data Model Reference

### Entity Relationship Diagram

```mermaid
erDiagram
    CLI_ARGS ||--o| DOCUMENT : "opens"
    DOCUMENT ||--o{ ANNOTATION : "contains"
    SESSION ||--|{ ANNOTATION : "persists"
    SESSION ||--|| DOCUMENT : "snapshots"
    SESSION ||--|| UI_STATE : "captures"

    CLI_ARGS {
        string compose_path
        string metadata_path
        string file_path
        string agent
    }

    DOCUMENT {
        string id PK
        string reply_content
        string compose_content
        string compose_path
        string reply_path
    }

    ANNOTATION {
        string id PK
        string selected_text
        string comment
        int paragraph_index
        int start_offset
        int end_offset
        timestamp created_at
    }

    SESSION {
        string id PK
        string name
        timestamp created_at
        timestamp updated_at
    }

    UI_STATE {
        string theme
        float font_scale
        float scroll_position
    }
```

### Type Definitions

```typescript
// Core types used throughout the application

type Theme = "dark" | "muted" | "light";

interface UIState {
  theme: Theme;
  fontScale: number;          // 0.8 – 1.5
  sidebarOpen: boolean;
  sidebarTab: "annotations" | "sessions" | "overview";
  scrollPosition: number;
}

interface ReturnState {
  mode: "writeback" | "clipboard";
  pending: boolean;
  lastResult: "success" | "error" | null;
  aggregatedContent: string | null;
}

interface SelectionState {
  selectedText: string | null;
  selectionRange: Range | null;
  anchorPosition: { x: number; y: number } | null;
}
```

---

## Security & Reliability

### Defensive Design Patterns

cliV employs several defensive patterns to ensure reliability:

#### 1. Atomic File Writes

All file writes use a **write-to-tmp + rename** pattern to prevent data corruption:

```
write(path.tmp) → rename(path.tmp → path) → success
                ↘ on failure: remove(path.tmp) → log error
```

#### 2. Cascading Fallbacks

Reply discovery uses ordered fallback strategies:

```mermaid
flowchart TD
    A["1. Cache by PID<br/>(most reliable)"] -->|"Miss"| B["2. Cache by Session ID<br/>(agent-provided)"]
    B -->|"Miss"| C["3. Transcript scan<br/>(full directory search)"]
    C -->|"Miss"| D["4. Manual file open<br/>(user intervention)"]

    A -->|"Hit"| SUCCESS["✅ Reply loaded"]
    B -->|"Hit"| SUCCESS
    C -->|"Hit"| SUCCESS

    style A fill:#c8e6c9
    style B fill:#e3f2fd
    style C fill:#fff3e0
    style D fill:#ffcdd2
```

#### 3. Defensive Process Tree Walk

The parent process walk is bounded to **5 levels** and handles all failure modes:

```rust
for level in 0..5 {
    if pid <= 1 { break; }         // Reached init
    let comm = match read(...) {
        Ok(s) => s,
        Err(_) => break,           // Can't read → stop
    };
    if let Some(agent) = match_agent_name(&comm) {
        return Some(agent);        // Found!
    }
    pid = extract_ppid(pid)?;      // Walk up
}
// Exhausted 5 levels → None
```

#### 4. Best-Effort Logging

Logging never panics, never blocks, and always continues:

```rust
fn log(msg: &str) {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    if let Ok(mut f) = OpenOptions::new()
        .create(true).append(true)
        .open("/tmp/cliv.log")
    {
        let _ = writeln!(f, "[{}] {}", ts, msg);
    }
    // If anything fails, silently continue
}
```

### Error Handling Matrix

| Component | Error | Strategy |
|:---|:---|:---|
| Cache write | Disk full / permissions | Log + return (no crash) |
| Cache read | File missing | Fallback to next strategy |
| Agent detection | Process not found | Return None (unknown agent) |
| Stdin read | Empty / invalid JSON | Log + return early |
| IPC call | Tauri bridge error | Show error in UI |
| Clipboard | Access denied | Show notification |
| Session save | Write failure | Log + show error |

---

## Roadmap & Vision

### Current Status vs. Planned Features

```mermaid
gantt
    title cliV Development Roadmap
    dateFormat YYYY-MM-DD
    axisFormat %Y-%m

    section Core
    CLI + GUI foundation       :done, 2025-01-01, 2025-04-01
    Multi-agent support        :done, 2025-04-01, 2025-07-01
    Annotation system          :done, 2025-07-01, 2025-10-01
    Session persistence        :done, 2025-10-01, 2026-01-01

    section Performance
    Virtual scrolling          :active, 2026-01-01, 2026-04-01
    Lazy Mermaid rendering     :2026-04-01, 2026-07-01

    section Features
    Diff and suggestion mode   :2026-04-01, 2026-07-01
    Plugin system              :2026-07-01, 2026-10-01

    section Platform
    macOS build                :2026-04-01, 2026-07-01
    Windows build              :2026-07-01, 2026-10-01
```

### Future Architecture Vision

```mermaid
graph TB
    subgraph "Current (v0.x)"
        direction TB
        C1["Single window"]
        C2["Local sessions"]
        C3["3 agents"]
    end

    subgraph "Near Future (v1.x)"
        direction TB
        F1["Virtual scrolling"]
        F2["Diff mode"]
        F3["Plugin API"]
    end

    subgraph "Long-term (v2.x)"
        direction TB
        L1["Multi-window"]
        L2["Cloud sync"]
        L3["Custom agent plugins"]
    end

    C1 --> F1
    C2 --> F2
    C3 --> F3
    F1 --> L1
    F2 --> L2
    F3 --> L3
```

---

## Appendix: Quick Reference

### Environment Variables

| Variable | Purpose | Example |
|:---|:---|:---|
| `EDITOR` | Set cliV as default editor | `export EDITOR="cliv"` |
| `CLIV_AGENT` | Force agent detection | `codex`, `claude`, `gemini` |
| `CODEX_THREAD_ID` | Active Codex cache key (compat name; usually the agent PID) | *(set by cliV or caller)* |
| `CODEX_HOME` | Codex config directory | `~/.codex` |
| `CLAUDE_SESSION_ID` | Claude session identifier | *(auto-set by Claude)* |
| `GEMINI_SESSION_ID` | Gemini session identifier | *(auto-set by Gemini)* |

### Key File Paths

| Path | Purpose |
|:---|:---|
| `~/.cliv/history/archive/` | Project-grouped archived reviews |
| `~/.codex/reply_cache/` | Cached Codex replies |
| `~/.claude/reply_cache/` | Cached Claude replies |
| `~/.gemini/reply_cache/` | Cached Gemini replies |
| `/tmp/cliv.log` | Diagnostic log file |

### CLI Usage

```bash
# Open a Markdown file for review
cliv document.md

# Cache an agent reply (called by hooks, not users)
cliv cache-codex '<json>'
cliv cache-claude          # reads from stdin
cliv cache-gemini          # reads from stdin

# Open with explicit compose target
cliv --compose /path/to/compose.md document.md

# Force specific agent detection
CLIV_AGENT=codex cliv document.md
```

### Tech Stack Summary

```mermaid
mindmap
  root((cliV))
    Frontend
      React 19
      Vite 7
      Zustand
      TailwindCSS 4
      react-markdown
      remark-gfm
      Mermaid.js
    Backend
      Tauri v2
      Rust
      serde_json
      dirs crate
    Integration
      Codex notify hook
      Claude Stop hook
      Gemini AfterAgent hook
    Storage
      File system cache
      localStorage
      Atomic writes

```

---

*This document was generated for demonstration purposes to showcase cliV's Markdown rendering capabilities, including headings, tables, code blocks, Mermaid diagrams (flowcharts, sequence diagrams, state diagrams, ER diagrams, Gantt charts, mind maps, class diagrams), blockquotes, and nested lists.*
