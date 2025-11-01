# Fluent Finder (Flf)

Fluent Finder (Flf) is a **vector-based code search tool** with a **fuzzy-finder-like interactive UI**. It enables fast, semantic search across your codebase by combining code parsing, embedding generation, and similarity search.

Flf supports two primary modes:
- `dir`: Search through all code files in a directory.
- `buf`: Search through the current buffers of your text editor (requires external buffer export).

It integrates seamlessly with Neovim, Vim or outputs plain JSON for custom scripting.
You can use [flf-vim](https://github.com/sirasagi62/flf-vim) for Vim/Neovim integration.

---

## 🚀 Installation

> [!WARNING]
> Due to [the bug in Bun](https://github.com/oven-sh/bun/issues/24158) that can prevent proper operation, please install using Node.js with `npm` or `pnpm` instead.

### Using pnpm

```bash
npm install -g @sirasagi62/flf
pnpm add -g @sirasagi62/flf
```

> Flf uses `@huggingface/transformers` and `veqlite` under the hood for embedding generation and vector search. 
---

## 📁 Directory Search (`dir`)

Search through all code files in a given directory.

### Basic Usage

```bash
flf dir -p /path/to/your/project
```

- `-p` or `--path`: Path to the directory to search (defaults to `.`).
- `-e` or `--editor`: Output format (`nvim`, `vim`, `cmd`). Default: `cmd`.

### Example: Open result in Neovim

```bash
flf dir -p . -e nvim
```

When you select an item, it outputs a Neovim command like:
```
<cmd>tabf +10 ./src/index.ts<CR>
```

That sends via nvim remote functions and it works with [flf-vim](https://github.com/sirasagi62/flf-vim)

---

## 💾 Buffer Search (`buf`)

Search through the **current buffers** of your text editor. This mode requires you to **export your editor's buffer content as JSON** first.

### Step 1: Export Editor Buffers

Create a JSON file containing your current buffers. The format should be:

```json
[
  {
    "buffername": "/full/path/to/file1.ts",
    "content": "function hello() {\n  console.log('Hello');\n}"
  },
  {
    "buffername": "/full/path/to/file2.py",
    "content": "def greet():\n    print('Hi')\n"
  }
]
```

> **How to export**: Use your editor's API to list open buffers and their content. For Neovim, you can use flf-vim.

### Step 2: Run Flf on Buffer Data

```bash
flf buf -p /path/to/buffers.json
```

- `-p` or `--path`: Path to the JSON file containing buffer data.
- `-e` or `--editor`: Output format (same as `dir`).

---

## 🖥️ Interactive UI

Flf launches an interactive TUI powered by `blessed`:

- **Input box**: Type your search query.
- **Left panel**: Shows matching code entities (functions, classes, etc.).
- **Right panel**: Syntax-highlighted preview of the selected item.

### Keybindings

- `↑` / `↓`: Navigate results.
- `Enter`: Select and output result.
- `Backspace`: Edit query.
- `Esc` / `q` / `Ctrl+C`: Quit.

---

## 🧩 Output Formats (`-e`)

| Format | Output Example |
|--------|----------------|
| `nvim` | `<cmd>tabf +10 ./src/index.ts<CR>` |
| `vim`  | `<cmd>tabf +10 ./src/index.ts<CR>` |
| `emacs`| (Planned) |
| `cmd`  | Raw JSON output |

> For Neovim/Vim, you can use [flf-vim](https://github.com/sirasagi62/flf-vim) for high level integration.

---

## 🛠️ How It Works

1. **Parsing**: Uses `code-chopper` to parse code into functions, classes, etc.
2. **Embedding**: Generates vector embeddings using a Hugging Face ONNX model.
3. **Indexing**: Stores chunks in a vector database (`veqlite` with PGLite).
4. **Search**: Performs similarity search on user query.

All processing is done locally — no data leaves your machine.

---

## 📂 Project Structure

- `src/index.ts`: CLI entrypoint with yargs.
- `src/dircore.ts`: Core logic for directory indexing.
- `src/buffercore.ts`: Core logic for buffer indexing.
- `src/buffer-loader.ts`: Loads buffer JSON.
- `src/types.ts`: Shared types.

---

## 📷 Screenshots
![Fluent Finder in directory](assets/flfdir.gif)

Neovim integration:
![Neovim integration](./assets/flfbuf.gif)
---

## 📄 License

MIT
