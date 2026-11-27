#!/usr/bin/env bash
set -euo pipefail

site_host=${1:?Indica el nombre DNS público}
[[ "$site_host" =~ ^[a-zA-Z0-9.-]+$ ]]
cd "$(dirname "$0")/../.."

dnf install -y nodejs22 tar gzip
test -x /usr/bin/node-22
id mi-dulce-tesoro >/dev/null 2>&1 || useradd --system --shell /sbin/nologin mi-dulce-tesoro
id caddy >/dev/null 2>&1 || useradd --system --home-dir /var/lib/caddy --shell /sbin/nologin caddy
install -d -m 700 /etc/mi-dulce-tesoro
install -d /opt/mi-dulce-tesoro /etc/caddy
install -d -o caddy -g caddy /var/lib/caddy
if [[ ! -e /etc/mi-dulce-tesoro/.env ]]; then
    install -m 600 .env.example /etc/mi-dulce-tesoro/.env
fi

if [[ ! -x /usr/local/bin/caddy ]]; then
    temp_dir=$(mktemp -d)
    trap 'rm -rf -- "$temp_dir"' EXIT
    version=2.11.9
    archive="caddy_${version}_linux_amd64.tar.gz"
    base="https://github.com/caddyserver/caddy/releases/download/v${version}"
    curl -fsSL "$base/$archive" -o "$temp_dir/$archive"
    curl -fsSL "$base/caddy_${version}_checksums.txt" -o "$temp_dir/checksums.txt"
    (cd "$temp_dir"; awk -v archive="$archive" '{ sub(/^[*]/, "", $2) } $2 == archive { print $1 "  " archive }' checksums.txt | sha512sum --check --strict)
    tar -xzf "$temp_dir/$archive" -C "$temp_dir" caddy
    install -m 755 "$temp_dir/caddy" /usr/local/bin/caddy
fi

cp -R src public /opt/mi-dulce-tesoro/
install -m 644 package.json /opt/mi-dulce-tesoro/package.json
install -m 644 deploy/ec2/mi-dulce-tesoro.service /etc/systemd/system/
install -m 644 deploy/ec2/caddy.service /etc/systemd/system/
install -m 644 deploy/ec2/Caddyfile /etc/caddy/Caddyfile
printf 'SITE_HOST=%s\n' "$site_host" > /etc/caddy/site.env
systemctl daemon-reload
systemctl enable mi-dulce-tesoro caddy
systemctl restart mi-dulce-tesoro
systemctl restart caddy
