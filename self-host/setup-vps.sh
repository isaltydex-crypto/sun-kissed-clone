#!/usr/bin/env bash
# ============================================================================
# One-shot VPS hardening for a fresh Ubuntu 22.04 / 24.04 host.
# Run as root (or with sudo) ONCE after first SSH:
#
#   curl -fsSL https://raw.githubusercontent.com/<you>/<repo>/main/self-host/setup-vps.sh | sudo bash
#
# Or after `git clone`:  sudo bash self-host/setup-vps.sh
#
# Idempotent — safe to re-run.
# ============================================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (sudo bash $0)"; exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"

echo "==> apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg lsb-release ufw fail2ban \
  unattended-upgrades apt-listchanges \
  htop git tmux nano

# ---------------------------------------------------------------------------
# 1. Swap (Hetzner / Contabo / OrangeWebsite small VPS often ship without)
# ---------------------------------------------------------------------------
if ! swapon --show | grep -q '^/swapfile'; then
  echo "==> creating 2 GiB swapfile"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

# ---------------------------------------------------------------------------
# 2. Unattended security updates
# ---------------------------------------------------------------------------
echo "==> enabling unattended-upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades
cat > /etc/apt/apt.conf.d/51unattended-upgrades-local <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

# ---------------------------------------------------------------------------
# 3. UFW firewall (only SSH/HTTP/HTTPS/IRC)
# ---------------------------------------------------------------------------
echo "==> configuring UFW"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}"/tcp comment 'SSH'
ufw allow 80/tcp   comment 'HTTP (Let'"'"'s Encrypt)'
ufw allow 443/tcp  comment 'HTTPS'
ufw allow 6697/tcp comment 'IRC over TLS'
# WireGuard VPN (used to gate /admin). Harmless if you never start the
# wireguard container — port stays closed at the application layer.
ufw allow 51820/udp comment 'WireGuard'
ufw --force enable


# ---------------------------------------------------------------------------
# 4. fail2ban — protect SSH from brute force
# ---------------------------------------------------------------------------
echo "==> configuring fail2ban"
cat > /etc/fail2ban/jail.d/sshd-local.conf <<EOF
[sshd]
enabled  = true
port     = ${SSH_PORT}
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# ---------------------------------------------------------------------------
# 5. Docker + compose plugin
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null; then
  echo "==> installing Docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

# ---------------------------------------------------------------------------
# 6. Deploy user
# ---------------------------------------------------------------------------
if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  echo "==> creating user ${DEPLOY_USER}"
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
  usermod -aG docker "${DEPLOY_USER}"
  install -d -m 700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
  if [[ -f /root/.ssh/authorized_keys ]]; then
    cp /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/authorized_keys"
    chown "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh/authorized_keys"
    chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
  fi
fi

# ---------------------------------------------------------------------------
# 7. SSH hardening
# ---------------------------------------------------------------------------
echo "==> hardening sshd"
SSHD=/etc/ssh/sshd_config.d/99-peptivalab.conf
cat > "${SSHD}" <<EOF
PermitRootLogin prohibit-password
PasswordAuthentication no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
EOF
systemctl reload ssh || systemctl reload sshd || true

echo
echo "============================================================"
echo " ✔ VPS hardening complete."
echo "   - Firewall:        $(ufw status | head -n1)"
echo "   - Deploy user:     ${DEPLOY_USER} (member of docker group)"
echo "   - Auto-updates:    enabled, reboot 04:00 UTC"
echo "   - fail2ban:        active on SSH (5 attempts / 10min → 1h ban)"
echo "   - Swap:            $(swapon --show --noheadings | head -n1 || echo none)"
echo
echo " Next: log in as ${DEPLOY_USER}, clone the repo, run apply-patch.sh,"
echo " then 'docker compose up -d' from self-host/."
echo "============================================================"
