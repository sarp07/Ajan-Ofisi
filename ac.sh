#!/bin/bash
# Linux: terminalde ./ac.sh yaz. İlk açılışta gerekli parçaları indirir, sonra uygulamayı açar.
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js bulunamadı. https://nodejs.org adresinden kur, sonra bu dosyaya yeniden çift tıkla."
  read -r -p "Kapatmak için Enter tuşuna bas."
  exit 1
fi
if [ ! -d node_modules/electron ]; then
  echo "İlk açılış: parçalar indiriliyor, birkaç dakika sürebilir."
  npm install || { read -r -p "Kurulum başarısız. Kapatmak için Enter tuşuna bas."; exit 1; }
fi
npm start
