#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/CalvinQin/dsh-provider-balance-quota"
REF="${DSH_PROVIDER_BALANCE_REF:-main}"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles"
PROFILE_PATCH="$PROFILE_DIR/web/cordis.patch.yml"
INSTALL_DIR="$PROFILE_DIR/node_modules"
TMP_DIR="$(mktemp -d -t dsh-provider-balance)"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

say() { printf '\033[1;36m[dsh-provider-balance]\033[0m %s\n' "$*"; }

say "Downloading $REPO ($REF)…"
curl -fsSL "$REPO/archive/refs/heads/$REF.tar.gz" -o "$TMP_DIR/project.tgz"
tar -xzf "$TMP_DIR/project.tgz" -C "$TMP_DIR"

CHATGPT_DIR="$(find "$TMP_DIR" -type d -name dsh-chatgpt-login -print -quit)"
SOURCE_DIR="${CHATGPT_DIR%/dsh-chatgpt-login}"
if [[ -z "$CHATGPT_DIR" || ! -d "$SOURCE_DIR/dsh-chatgpt-login" ]]; then
  echo "Could not find plugin packages in downloaded archive." >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR" "$PROFILE_DIR/web"
rm -rf "$INSTALL_DIR/dsh-balance-card" "$INSTALL_DIR/dsh-chatgpt-login"
cp -R "$SOURCE_DIR/dsh-balance-card" "$INSTALL_DIR/"
cp -R "$SOURCE_DIR/dsh-chatgpt-login" "$INSTALL_DIR/"

PATCH_HEADER='# Installed by dsh-provider-balance-quota'
touch "$PROFILE_PATCH"
if ! grep -q 'name: dsh-balance-card' "$PROFILE_PATCH"; then
  cat >> "$PROFILE_PATCH" <<'YAML'

# Installed by dsh-provider-balance-quota
- insert:
    - id: balance-card
      name: dsh-balance-card
      config:
        rev: 2
YAML
fi
if ! grep -q 'name: dsh-chatgpt-login' "$PROFILE_PATCH"; then
  cat >> "$PROFILE_PATCH" <<'YAML'

# Installed by dsh-provider-balance-quota
- insert:
    - id: chatgpt-login
      name: dsh-chatgpt-login
YAML
fi

say "Installed both plugins into $INSTALL_DIR"
say "Updated $PROFILE_PATCH"

if [[ "$(uname -s)" == "Darwin" ]] && command -v osascript >/dev/null 2>&1; then
  if pgrep -f 'DeepSeek Harness' >/dev/null 2>&1; then
    say "Restarting DeepSeek Harness…"
    osascript -e 'quit app "DeepSeek Harness"' >/dev/null 2>&1 || true
    sleep 2
    open -a "DeepSeek Harness" >/dev/null 2>&1 || true
  fi
fi

say "Done. Open Settings → 供应商余额与额度."
