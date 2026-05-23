# 📦 JS Dependency Tracer

A CLI tool that **traces JavaScript / TypeScript project dependencies starting from any entry file** and builds a **full dependency tree including file contents**.

It walks imports using a **breadth-first search (BFS)** so you can optionally cap how many levels deep the traversal goes.

It safely parses modern code including:

✅ React / React Native (JSX)
✅ TypeScript
✅ NestJS (decorators)
✅ Optional chaining / dynamic imports
✅ Circular dependency detection

This tool is useful when you want to:

🔍 Understand unfamiliar codebases
🧭 See how modules relate
📦 Extract only relevant files
🤖 Feed structured code context into AI tools
🛠 Refactor safely

---

## 🚀 Usage

```bash
npx js-dependency-tracer <entry-file> [max-depth]
```

- **`<entry-file>`** *(required)* — path to the JS/TS file to start tracing from.
- **`[max-depth]`** *(optional)* — non-negative integer. Limits how many import levels are followed. Omit to traverse every reachable file.

### Depth semantics

| `max-depth` | What you get |
|---|---|
| `0` | Entry file only — no imports traced |
| `1` | Entry + its direct imports |
| `N` | Entry + everything within N hops |
| *(omitted)* | Full traversal until every reachable file is parsed |

### Examples

```bash
# Full BFS traversal — every reachable relative import
npx js-dependency-tracer ./src/app.js

# Only the entry file
npx js-dependency-tracer ./src/app.js 0

# Entry + its immediate imports
npx js-dependency-tracer ./src/app.js 1

# Two levels deep, saved to a file
npx js-dependency-tracer ./src/app.js 2 > tree.json
```

---

## 📥 Installation

### Run on the fly with npx (no install)

```bash
npx js-dependency-tracer ./src/app.js
```

Use `npx js-dependency-tracer@latest ...` to bypass npx's cache, or `@1.0.4` to pin a version.

### Install globally

```bash
npm install -g js-dependency-tracer
js-dependency-tracer ./src/app.js
```

### Install as a project dependency

```bash
npm install --save-dev js-dependency-tracer
```

Then add a script to your `package.json`:

```json
{
  "scripts": {
    "trace": "js-dependency-tracer src/index.js 2"
  }
}
```

```bash
npm run trace
```

---

## 📤 Output

The tree is printed as JSON to **stdout**. Parse warnings go to **stderr**, so you can safely redirect stdout to a file:

```bash
npx js-dependency-tracer ./src/app.js 2 > tree.json
```

### Shape

```json
{
  "file": "/abs/path/to/entry.js",
  "content": "...source code...",
  "imports": [
    {
      "file": "/abs/path/to/child.js",
      "content": "...",
      "imports": [ ... ]
    }
  ]
}
```

Each node contains:
- `file` — absolute path to the source file
- `content` — the file's full source
- `imports` — array of child nodes (recursive)

Additional fields that may appear:
- `skipped: "binary"` — file was detected as binary and skipped
- `parseError: "..."` — file couldn't be parsed; content is still included

---

## 🧭 What gets traced

**Followed:**
- Relative imports (`./foo`, `../bar`) and absolute imports (`/abs/path`)
- Resolves to `.js`, `.jsx`, `.ts`, `.tsx`, `.d.ts`
- Resolves directory imports via `index.*`

**Skipped:**
- Bare module specifiers (`react`, `lodash`, etc.)
- `.json` imports
- Binary files
- Files already visited (cycles are safe)

---

## 🧠 How it works

1. Parses the entry file with `@babel/parser` (TS, JSX, decorators, etc. enabled based on file extension).
2. Collects every `ImportDeclaration` source from the AST.
3. Resolves each relative/absolute specifier against the filesystem.
4. Enqueues unvisited resolved files for parsing.
5. Processes the queue **breadth-first** — all siblings at one level before descending — until the queue drains or `max-depth` is reached.

A shared `visited` set ensures each file is parsed exactly once, even across circular imports.

---

## 🧩 Programmatic use

```js
const { parseFile } = require('js-dependency-tracer');

const tree = parseFile('./src/app.js', 2);   // maxDepth optional, defaults to Infinity
console.log(JSON.stringify(tree, null, 2));
```

---

## 📜 License

MIT © Piyush Jamwal
