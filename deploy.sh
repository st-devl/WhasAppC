#!/bin/bash

# Mac/Linux terminalinde npm'in bulanamama ihtimaline karşı yolları dahil et
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin

# Renk paleti
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   🚀 WhasAppC Pro Otomatik Dağıtım Aracı   ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Whatsapp-engine klasörüne geçip (kodların olduğu yer) versiyonu artırma
cd whatsapp-engine || { echo -e "${RED}Hata: whatsapp-engine klasörü bulunamadı!${NC}"; exit 1; }

# "npm version patch" komutu package.json dosyasını okur, versiyonu (Örn: 1.3.0) alıp 1.3.1 şeklinde otomatik yazar.
# Bu sayede versiyon numarasını biz elle girmeyiz, kendi otomatik kaydırır.
NEW_VERSION=$(npm version patch)

cd ..

echo -e "${GREEN}✨ Versiyon başarıyla artırıldı: ${NEW_VERSION}${NC}"
echo -e "${BLUE}📡 Github'a paketlenip çekirdek sunucuya (Hostinger) gönderiliyor...${NC}"

# Tüm değişikliği kaydet ve Gönder
git add .
git commit -m "🚀 deploy: otomatik sürüm dağıtımı ${NEW_VERSION}"
git push origin main

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}✅ İşlem Tamamlandı!${NC}"
echo -e "${GREEN} Hostinger 30-60 saniye içinde algılayıp sistemi ${NEW_VERSION} sürümüyle yenileyecektir.${NC}"
echo -e "${GREEN} Siteye girdiğinizde Sol/Orta Üst panelde bu numarayı görebilirsiniz.${NC}"
echo -e "${GREEN}==============================================${NC}"
