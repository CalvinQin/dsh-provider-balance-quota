#!/usr/bin/env bash
# dsh-provider-balance-quota installer — installs both plugins from npm as
# standard DSH bundles via the official `dsh plugin` command.
#
#   curl -fsSL https://raw.githubusercontent.com/CalvinQin/dsh-provider-balance-quota/main/install.sh | bash
#
# Env overrides:
#   DSH_PROVIDER_BALANCE_PROFILE  target profile (default: desktop)
#   DSH                           dsh command (default: dsh; DSH Desktop 2.x
#                                 terminals provide `dsh` on PATH)
set -euo pipefail

PROFILE="${DSH_PROVIDER_BALANCE_PROFILE:-desktop}"
DSH="${DSH:-dsh}"

say() { printf '\033[1;36m[dsh-provider-balance]\033[0m %s\n' "$*"; }

if ! command -v "$DSH" >/dev/null 2>&1; then
  echo "error: '$DSH' command not found on PATH." >&2
  echo "  In DSH Desktop 2.x: tray → Open DSH Terminal, then run this script there." >&2
  echo "  Otherwise: npm i -g @deepseek-ai/dsh, or use the app-bundled dsh CLI." >&2
  exit 1
fi

say "Installing dsh-balance-card + dsh-chatgpt-login into profile '$PROFILE' (from npm)…"
"$DSH" plugin --profile "$PROFILE" add dsh-balance-card dsh-chatgpt-login

if [[ "$(uname -s)" == "Darwin" ]] && command -v osascript >/dev/null 2>&1; then
  for APP in "DSH Desktop" "DeepSeek Harness"; do
    if pgrep -f "$APP" >/dev/null 2>&1; then
      say "Restarting $APP…"
      osascript -e "quit app \"$APP\"" >/dev/null 2>&1 || true
      sleep 2
      open -a "$APP" >/dev/null 2>&1 || true
      break
    fi
  done
fi

say "Done. Open Settings → 供应商余额与额度."
