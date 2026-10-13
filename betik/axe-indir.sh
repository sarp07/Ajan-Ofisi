#!/usr/bin/env bash
# AXe (github.com/cameroncooke/AXe, MIT lisanslı): iOS simülatörünü canlı akıtır ve dokunma, kaydırma, yazı gönderir.
# Sabit sürüm ve sağlama toplamıyla indirilir, paket/axe klasörüne açılır; Mac paketine gömülür ve uygulamayla imzalanır.
# Kullanıcı ayrıca bir şey kurmaz.
set -euo pipefail
cd "$(dirname "$0")/.."

SURUM="v1.8.0"
DOSYA="AXe-macOS-${SURUM}-universal.tar.gz"
SHA="7b76340b72e90d0f211bc7c4636f15009076eff07acef2f2b632b175debd8834"
HEDEF="paket/axe"

if [[ -x "$HEDEF/axe" ]] && [[ "$(cat "$HEDEF/.surum" 2>/dev/null)" == "$SURUM" ]]; then
  echo "AXe $SURUM zaten hazır."
  exit 0
fi
GECICI="$(mktemp -d)"
trap 'rm -rf "$GECICI"' EXIT
curl -fsSL -o "$GECICI/$DOSYA" "https://github.com/cameroncooke/AXe/releases/download/${SURUM}/${DOSYA}"
echo "$SHA  $GECICI/$DOSYA" | shasum -a 256 -c -
rm -rf "$HEDEF"
mkdir -p "$HEDEF"
tar -xzf "$GECICI/$DOSYA" -C "$HEDEF"
# yapay zekâ istemcilerine kurulacak skill dosyaları gerekmez
rm -rf "$HEDEF/AXe_AXe.bundle/skills"
curl -fsSL -o "$HEDEF/LICENSE" "https://raw.githubusercontent.com/cameroncooke/AXe/${SURUM}/LICENSE" || true
echo "$SURUM" > "$HEDEF/.surum"
echo "AXe $SURUM hazır: $HEDEF"
