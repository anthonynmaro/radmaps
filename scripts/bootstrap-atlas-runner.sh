#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/anthonynmaro/radmaps}"
RUNNER_LABELS="${RUNNER_LABELS:-atlas-runner}"
RUNNER_NAME="${RUNNER_NAME:-$(hostname)-atlas}"
RUNNER_USER="${RUNNER_USER:-atlasrunner}"
RUNNER_HOME="${RUNNER_HOME:-/opt/actions-runner}"
MIN_FREE_GB="${MIN_FREE_GB:-500}"

if [[ -z "${GITHUB_RUNNER_TOKEN:-}" ]]; then
  echo "GITHUB_RUNNER_TOKEN is required." >&2
  echo "Create one with:" >&2
  echo "  gh api repos/anthonynmaro/radmaps/actions/runners/registration-token --method POST --jq .token" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script with sudo/root on the runner VM." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl git jq tar gzip docker.io

systemctl enable --now docker

if ! id "$RUNNER_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$RUNNER_USER"
fi
usermod -aG docker "$RUNNER_USER"
printf '%s ALL=(ALL) NOPASSWD: /usr/bin/chown, /usr/bin/rm\n' "$RUNNER_USER" > "/etc/sudoers.d/${RUNNER_USER}-atlas-runner"
chmod 0440 "/etc/sudoers.d/${RUNNER_USER}-atlas-runner"

mkdir -p "$RUNNER_HOME"
chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_HOME"

free_gb="$(df -Pk "$RUNNER_HOME" | awk 'NR==2 { printf "%.0f", $4 / 1024 / 1024 }')"
if (( free_gb < MIN_FREE_GB )); then
  echo "Need at least ${MIN_FREE_GB}GB free at ${RUNNER_HOME}; found ${free_gb}GB." >&2
  exit 1
fi

runner_version="$(
  curl -fsSL https://api.github.com/repos/actions/runner/releases/latest |
    jq -r '.tag_name | sub("^v"; "")'
)"
runner_tar="actions-runner-linux-x64-${runner_version}.tar.gz"
runner_url="https://github.com/actions/runner/releases/download/v${runner_version}/${runner_tar}"

cd "$RUNNER_HOME"

if [[ ! -f ./config.sh ]]; then
  sudo -u "$RUNNER_USER" curl -fsSLo "$runner_tar" "$runner_url"
  sudo -u "$RUNNER_USER" tar xzf "$runner_tar"
  rm -f "$runner_tar"
fi

if [[ -f .runner ]]; then
  ./svc.sh stop || true
  ./svc.sh uninstall || true
  sudo -u "$RUNNER_USER" ./config.sh remove --unattended --token "$GITHUB_RUNNER_TOKEN" || true
fi

sudo -u "$RUNNER_USER" ./config.sh \
  --url "$REPO_URL" \
  --token "$GITHUB_RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --work _work \
  --unattended \
  --replace

./svc.sh install "$RUNNER_USER"
./svc.sh start

docker --version
./svc.sh status

echo "Atlas runner is online as ${RUNNER_NAME} with labels ${RUNNER_LABELS}."
