# Installation

## Prerequisites

Dial Code requires **Node.js version 20 or higher**.

=== "Check Version"
`bash
    node --version
    # Should output v20.x.x or higher
    `

=== "Install Node.js"
Download from [nodejs.org](https://nodejs.org/) or use a version manager:
`bash
    # Using nvm
    nvm install 20
    nvm use 20
    `

---

## Install from Source

```bash
# Clone the repository
git clone https://github.com/neul-labs/dial-coder.git

# Navigate and install dependencies
cd dial-coder
npm install

# Install globally
npm install -g .
```

---

## Verify Installation

```bash
dial --version
```

You should see the version number displayed.

---

## Update

To update to the latest version:

```bash
cd dial-coder
git pull
npm install
npm install -g .
```

---

## Uninstall

```bash
# Remove global installation
npm uninstall -g dial-coder

# Remove the repository
rm -rf dial-coder
```

---

## Troubleshooting

### Permission Errors

If you encounter permission errors during global install:

```bash
# Option 1: Use sudo (Linux/macOS)
sudo npm install -g .

# Option 2: Configure npm prefix
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### Node Version Issues

If you see errors about Node.js version:

```bash
# Check your version
node --version

# Use nvm to switch versions
nvm install 20
nvm use 20
```

---

## Next Steps

- [Authentication](authentication.md) - Connect to an LLM provider
- [Quick Start](quick-start.md) - Run your first session
