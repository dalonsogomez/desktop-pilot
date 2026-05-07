# Installation

## Prerequisites

- macOS 13.0+ (verified up to 26)
- 16 GB RAM minimum (32 GB+ recommended)
- 20 GB free disk space
- Homebrew installed
- Anthropic API key from https://console.anthropic.com

## Step-by-step

```bash
# 1. Clone or pull this repo
cd /Users/$(whoami)/desktop-pilot

# 2. Run the bootstrap installer
bash scripts/bootstrap.sh
```

The installer will:

1. Run preflight checks (macOS version, RAM, disk, Homebrew, Node, Swift, jq).
2. Install npm dependencies and build TypeScript.
3. Build Swift binaries (`screen-recorder`, `panic-key`, `gui-actor`).
4. Prompt for your Anthropic API key and store it in Keychain.
5. Copy default config files to `~/.config/desktop-pilot/`.
6. Generate and load the launchd plist.

After install, **grant macOS permissions manually** (the installer cannot do this for you):

- **System Settings → Privacy & Security:**
  - **Accessibility:** Terminal, node, `screen-recorder`, `panic-key`, `gui-actor`
  - **Screen Recording:** `screen-recorder`
  - **Input Monitoring:** `panic-key`
  - **Automation:** allow Terminal to control Finder, Safari, Mail, etc.

Verify with:

```bash
bash scripts/smoke-test.sh
```

## Optional: UI-TARS local backend

Instead of Anthropic's cloud API, you can run the UI-TARS-1.5-7B model locally via Ollama.

### Prerequisites

- [Ollama](https://ollama.com) installed and running
- At least 16 GB RAM (model requires ~8 GB VRAM or system RAM)

### Setup

```bash
# Pull the model
ollama pull 0000/ui-tars-1.5-7b

# Verify it is available
ollama list
```

Then update `~/.config/desktop-pilot/config.yaml`:

```yaml
backend: ui-tars
ollamaUrl: "http://localhost:11434"
ollamaModel: "0000/ui-tars-1.5-7b"
displayWidth: 1920   # set to your actual display width
displayHeight: 1080  # set to your actual display height
```

Restart the sidecar for the change to take effect. No Anthropic API key is needed when using this backend.

## Manual launchd controls

```bash
# Stop sidecar
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/ai.desktop-pilot.bridge.plist

# Start sidecar
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/ai.desktop-pilot.bridge.plist

# View logs
tail -f ~/Library/Logs/desktop-pilot-bridge.{out,err}.log
```
