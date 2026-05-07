#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/Users/$(whoami)/desktop-pilot}"
echo "Installing desktop-pilot to $INSTALL_DIR"

# Run doctor
bash "$INSTALL_DIR/scripts/doctor.sh"

# Install npm deps and build
cd "$INSTALL_DIR"
npm install
npm run build

# Build Swift binaries
cd "$INSTALL_DIR/recorder-swift"
swift build -c release
mkdir -p "$INSTALL_DIR/bin"
cp .build/release/screen-recorder "$INSTALL_DIR/bin/"
cp .build/release/panic-key "$INSTALL_DIR/bin/"
cp .build/release/gui-actor "$INSTALL_DIR/bin/"

# Prompt for API key
echo ""
echo "Enter your Anthropic API key (or paste empty to skip):"
read -s ANTHROPIC_KEY
if [ -n "$ANTHROPIC_KEY" ]; then
  security add-generic-password \
    -s "ai.desktop-pilot.anthropic" \
    -a "default" \
    -w "$ANTHROPIC_KEY" \
    -U
  echo "API key stored in Keychain."
fi

# Install config files if missing
mkdir -p "$HOME/.config/desktop-pilot"
for f in config.yaml allowlist.yaml applescript-allowlist.yaml; do
  if [ ! -f "$HOME/.config/desktop-pilot/$f" ]; then
    cp "$INSTALL_DIR/config/$f.example" "$HOME/.config/desktop-pilot/$f"
    echo "Wrote $HOME/.config/desktop-pilot/$f"
  fi
done

# Generate launchd plist with substitutions.
#
# Resolve real node binary path: `which node` returns the nvm shell function
# on systems with nvm — use process.execPath to get the actual binary path,
# with fallback to Homebrew's known stable symlinks if Node isn't yet on PATH.
NODE_PATH=$(node -e "console.log(process.execPath)" 2>/dev/null || true)
if [ -z "$NODE_PATH" ] && [ -x "/opt/homebrew/bin/node" ]; then
  NODE_PATH="/opt/homebrew/bin/node"
elif [ -z "$NODE_PATH" ] && [ -x "/usr/local/bin/node" ]; then
  NODE_PATH="/usr/local/bin/node"
fi
if [ -z "$NODE_PATH" ]; then
  echo "ERROR: cannot resolve node binary path. Install via Homebrew (brew install node) and re-run." >&2
  exit 1
fi
echo "Using node binary: $NODE_PATH"

PLIST="$HOME/Library/LaunchAgents/ai.desktop-pilot.bridge.plist"
mkdir -p "$HOME/Library/LaunchAgents"
sed -e "s|__INSTALL_DIR__|$INSTALL_DIR|g" \
    -e "s|__HOME__|$HOME|g" \
    -e "s|__NODE_PATH__|$NODE_PATH|g" \
    "$INSTALL_DIR/scripts/launchd/ai.desktop-pilot.bridge.plist" > "$PLIST"
echo "Wrote $PLIST"

# Load
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

# Permissions reminder
cat <<EOF

=== PERMISSION SETUP REQUIRED ===

Open System Settings → Privacy & Security and grant:
  1. Accessibility       → Terminal (or your shell), node, screen-recorder, panic-key, gui-actor
  2. Screen Recording    → screen-recorder
  3. Input Monitoring    → panic-key
  4. Automation          → allow Terminal/your shell to control: Finder, Mail, Safari, Notes, etc.

Then run:  bash $INSTALL_DIR/scripts/smoke-test.sh

=== INSTALL COMPLETE ===
EOF
