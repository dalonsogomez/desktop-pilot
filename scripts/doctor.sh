#!/usr/bin/env bash
set -euo pipefail

echo "=== desktop-pilot doctor ==="

# macOS version
ver=$(sw_vers -productVersion)
major=$(echo "$ver" | cut -d. -f1)
if [ "$major" -lt 13 ]; then
  echo "FAIL macOS $ver (need 13+)"
  exit 1
fi
echo "PASS macOS $ver"

# RAM
ram_gb=$(($(sysctl -n hw.memsize) / 1024 / 1024 / 1024))
if [ "$ram_gb" -lt 16 ]; then
  echo "WARN  RAM ${ram_gb}GB (16GB+ recommended)"
else
  echo "PASS  RAM ${ram_gb}GB"
fi

# Disk (1K-blocks → GB)
free_gb=$(df -k / | awk 'NR==2 {print int($4/1024/1024)}')
if [ "$free_gb" -lt 20 ]; then
  echo "WARN  Free disk ${free_gb}GB (20GB+ recommended)"
else
  echo "PASS  Free disk ${free_gb}GB"
fi

# Homebrew
if ! command -v brew >/dev/null; then
  echo "FAIL  Homebrew not installed. Install from https://brew.sh"
  exit 1
fi
echo "PASS  Homebrew $(brew --version | head -n1)"

# Node 20+
if ! command -v node >/dev/null; then
  echo "FAIL  Node not installed. brew install node@20"
  exit 1
fi
node_major=$(node -v | sed 's/v\([0-9]*\).*/\1/')
if [ "$node_major" -lt 20 ]; then
  echo "FAIL  Node $(node -v) (need 20+)"
  exit 1
fi
echo "PASS  Node $(node -v)"

# Swift
if ! command -v swift >/dev/null; then
  echo "FAIL  Swift not installed. xcode-select --install"
  exit 1
fi
echo "PASS  Swift $(swift --version | head -n1)"

# jq
if ! command -v jq >/dev/null; then
  echo "FAIL  jq not installed. brew install jq"
  exit 1
fi
echo "PASS  jq $(jq --version)"

# ffprobe (for smoke test)
if ! command -v ffprobe >/dev/null; then
  echo "WARN  ffprobe not installed (smoke test for video will skip). brew install ffmpeg"
else
  echo "PASS  ffprobe $(ffprobe -version | head -n1 | awk '{print $3}')"
fi

echo "=== doctor complete ==="
