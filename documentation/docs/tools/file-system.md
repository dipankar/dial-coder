# File System Tools

Tools for reading, writing, and navigating files.

---

## read_file

Read the contents of a file.

**Usage:**

```
> Show me the contents of package.json
```

Or with `@` syntax:

```
> Explain @src/index.ts
```

**Parameters:**

| Parameter | Type   | Description       |
| --------- | ------ | ----------------- |
| `path`    | string | File path to read |

**Confirmation:** Not required

---

## write_file

Create or overwrite a file.

**Usage:**

```
> Create a new file called hello.js with a hello world function
```

**Parameters:**

| Parameter | Type   | Description  |
| --------- | ------ | ------------ |
| `path`    | string | File path    |
| `content` | string | File content |

**Confirmation:** Required (shows diff for existing files)

---

## edit

Smart code editing with diff-based modifications.

**Usage:**

```
> Add error handling to the fetchData function in api.js
```

**Parameters:**

| Parameter     | Type   | Description         |
| ------------- | ------ | ------------------- |
| `path`        | string | File path           |
| `old_content` | string | Content to replace  |
| `new_content` | string | Replacement content |

**Confirmation:** Required (shows diff)

**Features:**

- Context-aware replacements
- Preserves formatting
- Shows clear diffs

---

## list_directory

List contents of a directory.

**Usage:**

```
> What files are in the src folder?
```

**Parameters:**

| Parameter | Type   | Description    |
| --------- | ------ | -------------- |
| `path`    | string | Directory path |

**Confirmation:** Not required

---

## glob

Find files matching a pattern.

**Usage:**

```
> Find all TypeScript files in the project
```

**Parameters:**

| Parameter | Type   | Description                   |
| --------- | ------ | ----------------------------- |
| `pattern` | string | Glob pattern                  |
| `path`    | string | Starting directory (optional) |

**Patterns:**

| Pattern               | Matches                         |
| --------------------- | ------------------------------- |
| `*.ts`                | TypeScript files in current dir |
| `**/*.ts`             | TypeScript files recursively    |
| `src/**/*.{ts,tsx}`   | TS/TSX files in src             |
| `!**/node_modules/**` | Exclude node_modules            |

**Confirmation:** Not required

---

## grep

Search file contents with regex support.

**Usage:**

```
> Find all TODO comments in the codebase
```

**Parameters:**

| Parameter | Type   | Description             |
| --------- | ------ | ----------------------- |
| `pattern` | string | Search pattern (regex)  |
| `path`    | string | Directory to search     |
| `include` | string | File pattern to include |

**Examples:**

```
> Search for "import React" in all tsx files
> Find functions that start with "handle"
> Look for console.log statements
```

**Confirmation:** Not required

---

## Common Patterns

### Exploring Code

```
> Show me all files in this project
> What TypeScript files are there?
> Find the main entry point
```

### Reading Files

```
> Show me package.json
> Read the README
> What's in src/index.ts?
```

### Searching

```
> Find all uses of useState
> Search for "TODO" comments
> Where is the User model defined?
```

### Modifying Files

```
> Add a new function to utils.ts
> Fix the typo in README.md
> Update the version in package.json
```

---

## File References with @

The `@` symbol provides quick file context:

```
> Explain @src/components/Button.tsx
> What does @package.json say about the version?
> Refactor @utils/helpers.js
```

Multiple files:

```
> Compare @old.ts and @new.ts
```

Folders:

```
> What's in @src/components/?
```

---

## Respecting Ignore Files

By default, file tools respect:

- `.gitignore`
- `.dialignore`

Configure in settings:

```json
{
  "respectGitignore": true,
  "respectDialignore": true
}
```

---

## Next Steps

- [Shell](shell.md) - Command execution
- [MCP](mcp.md) - External tools
