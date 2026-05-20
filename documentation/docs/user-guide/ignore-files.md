# Ignoring Files

This document provides an overview of the Dial Ignore (`.dialignore`) feature of Dial Coder.

Dial Coder includes the ability to automatically ignore files, similar to `.gitignore` (used by Git). Adding paths to your `.dialignore` file will exclude them from tools that support this feature, although they will still be visible to other services (such as Git).

## How it works

When you add a path to your `.dialignore` file, tools that respect this file will exclude matching files and directories from their operations. For example, when you use the [`read_many_files`](../tools/multi-file.md) command, any paths in your `.dialignore` file will be automatically excluded.

For the most part, `.dialignore` follows the conventions of `.gitignore` files:

- Blank lines and lines starting with `#` are ignored.
- Standard glob patterns are supported (such as `*`, `?`, and `[]`).
- Putting a `/` at the end will only match directories.
- Putting a `/` at the beginning anchors the path relative to the `.dialignore` file.
- `!` negates a pattern.

You can update your `.dialignore` file at any time. To apply the changes, you must restart your Dial Coder session.

## How to use `.dialignore`

To enable `.dialignore`:

1. Create a file named `.dialignore` in the root of your project directory.

To add a file or directory to `.dialignore`:

1. Open your `.dialignore` file.
2. Add the path or file you want to ignore, for example: `/archive/` or `apikeys.txt`.

### `.dialignore` examples

You can use `.dialignore` to ignore directories and files:

```
# Exclude your /packages/ directory and all subdirectories
/packages/

# Exclude your apikeys.txt file
apikeys.txt
```

You can use wildcards in your `.dialignore` file with `*`:

```
# Exclude all .md files
*.md
```

Finally, you can exclude files and directories from exclusion with `!`:

```
# Exclude all .md files except README.md
*.md
!README.md
```

To remove paths from your `.dialignore` file, delete the relevant lines.
