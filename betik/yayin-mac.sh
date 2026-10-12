#!/usr/bin/env bash
# macOS kurulum dosyalarını üretir: Developer ID ile imzalı, Apple onaylı (notarized).
# Apple Silicon ve Intel için birer dmg çıkar, gh kuruluysa GitHub sürümüne yüklenir.
#
# Bir kerelik hazırlık (bu Mac'te başka bir uygulama için yapıldıysa yeniden gerekmez):
#   1. Xcode > Settings > Accounts > Manage Certificates > + > "Developer ID Application"
#   2. xcrun notarytool store-credentials notchisland --apple-id <apple kimliği> --team-id <TAKIM_KIMLIGI>
#      (appleid.apple.com üzerinden alınan uygulamaya özel şifreyi sorar)
#
# Kullanım:  npm run yayin:mac
# Başka bir onay profili için:  NOTARY_PROFILE=<profil adı> npm run yayin:mac
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Bu betik yalnızca macOS üzerinde çalışır." >&2
  exit 1
fi
if ! security find-identity -v -p codesigning | grep -q '"Developer ID Application: '; then
  echo "Anahtar zincirinde \"Developer ID Application\" sertifikası bulunamadı (yukarıdaki hazırlığa bak)." >&2
  exit 1
fi
PROFIL="${NOTARY_PROFILE:-notchisland}"
SURUM="$(node -p "require('./package.json').version")"

[[ -d node_modules/electron-builder ]] || npm install
npm test
rm -rf cikti

# electron-builder uygulamayı sertifikayla imzalar, Apple'a onaya gönderir ve onayı uygulamaya işler.
# Onay birkaç dakika sürebilir.
APPLE_KEYCHAIN_PROFILE="$PROFIL" npx electron-builder --mac dmg zip --arm64 --x64 --publish never

for UYG in cikti/mac*/*.app; do
  spctl --assess --type execute --verbose "$UYG"
  xcrun stapler validate "$UYG"
done
ls -lh cikti/*.dmg cikti/*.zip

ETIKET="v$SURUM"
if command -v gh >/dev/null 2>&1; then
  if ! gh release view "$ETIKET" >/dev/null 2>&1; then
    gh release create "$ETIKET" --title "$ETIKET" --generate-notes
  fi
  # dmg ilk kurulum için; zip, blockmap ve latest-mac.yml uygulama içi güncelleme için
  gh release upload "$ETIKET" cikti/*.dmg cikti/*.zip cikti/*.blockmap cikti/latest-mac.yml --clobber
  echo "Tamam: dmg dosyaları $ETIKET sürümüne yüklendi."
else
  echo "Tamam: dmg dosyaları cikti klasöründe. GitHub'da $ETIKET sürümüne elle yükle (gh kurulu değil)."
fi
