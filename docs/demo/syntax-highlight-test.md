# 代码语法高亮测试

## TypeScript

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

export async function fetchUsers(): Promise<User[]> {
  const response = await fetch("/api/users");
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }
  return response.json();
}

const greeting = (name: string): string => `Hello, ${name}!`;
console.log(greeting("World"));
```

## Python

```python
from dataclasses import dataclass
from typing import List, Optional
import asyncio

@dataclass
class Task:
    title: str
    done: bool = False
    priority: int = 0

async def process_tasks(tasks: List[Task]) -> None:
    for task in tasks:
        if not task.done:
            print(f"Processing: {task.title} (priority={task.priority})")
            await asyncio.sleep(0.1)

# List comprehension
active = [t for t in tasks if not t.done and t.priority > 3]
result = sum(t.priority for t in active)
```

## Rust

```rust
use std::collections::HashMap;

#[derive(Debug, Clone)]
struct Config {
    name: String,
    values: HashMap<String, i32>,
}

impl Config {
    fn new(name: &str) -> Self {
        Config {
            name: name.to_string(),
            values: HashMap::new(),
        }
    }

    fn get(&self, key: &str) -> Option<&i32> {
        self.values.get(key)
    }
}

fn main() {
    let mut config = Config::new("default");
    config.values.insert("timeout".into(), 30);
    println!("Config: {:?}", config);
}
```

## Bash / Shell

```bash
#!/bin/bash
set -euo pipefail

# Variables
APP_NAME="cliv"
VERSION=$(cat Cargo.toml | grep "^version" | head -1 | cut -d'"' -f2)

# Function
build_release() {
    echo "Building $APP_NAME v$VERSION..."
    cargo build --release
    if [ $? -eq 0 ]; then
        echo "Build successful!"
    else
        echo "Build failed!" >&2
        exit 1
    fi
}

# Array and loop
TARGETS=("x86_64-unknown-linux-gnu" "aarch64-unknown-linux-gnu")
for target in "${TARGETS[@]}"; do
    echo "Cross-compiling for $target"
    cargo build --release --target "$target"
done
```

## JavaScript / JSX

```javascript
import React, { useState, useEffect } from "react";

function Counter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    document.title = `Count: ${count}`;
    return () => { document.title = "App"; };
  }, [count]);

  return (
    <div className="counter">
      <h2>Count: {count}</h2>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

## JSON

```json
{
  "name": "cliv",
  "version": "0.2.0",
  "dependencies": {
    "@uiw/react-markdown-preview": "^5.0.0",
    "mermaid": "^11.0.0",
    "zustand": "^5.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build"
  }
}
```

## CSS

```css
:root {
  --primary: #3b82f6;
  --bg-dark: #0f172a;
}

.container {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
  .container {
    flex-direction: column;
  }
}
```

## SQL

```sql
SELECT
    u.name,
    u.email,
    COUNT(o.id) AS order_count,
    SUM(o.total) AS total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.is_active = true
  AND o.created_at >= '2025-01-01'
GROUP BY u.id, u.name, u.email
HAVING COUNT(o.id) > 5
ORDER BY total_spent DESC
LIMIT 10;
```

## YAML

```yaml
name: Release Build
on:
  push:
    tags: ["v*"]

jobs:
  build:
    runs-on: ubuntu-22.04
    strategy:
      matrix:
        target:
          - x86_64-unknown-linux-gnu
          - aarch64-unknown-linux-gnu
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: cargo build --release --target ${{ matrix.target }}
```

## 无语言标识的代码块

```
This is a plain code block without any language tag.
No syntax highlighting should be applied here.
Just monospace font with code background.
```
