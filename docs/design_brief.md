# 🎨 Tasarım Yönergesi (Design System Specification)

Bu doküman projenin görsel ve UI/UX anayasasını tanımlar. Kararlar "Premium, Resmi, Güvenli" hissini maksimumda tutmak içindir. Tüketici tipi "canlı-esnek" formlar yerine, veri yoğun sistemlere uygun formlar tasarlandı.

## 1. Konsept: "The Architectural Ledger"
UI'ın tüm öğeleri ağırbaşlı bir Finans Terminali (Financial Terminal) veya yüksek düzey bir CRM olarak öngörülür. Tasarımcılar ve Frontend geliştiriciler estetiği çizgilerle değil, arkaplan ton geçişleri (katmanlar / layers) ile şekillendirmelidir.

## 2. "The No-Line Rule" (Çizgisiz Tasarım)
Sistemde container veya section'ları ayıran "1px solid border" kullanımı **YASAKTIR.**
Fiziksel boyutlar sadece background ton değişimleri ile yaratılmalıdır:
- **Surface (Ekran Arkaplanı):** `#f8f9ff`
- **Surface-Container-Lowest (En ön/aktif Kartlar):** `#ffffff` 
- **Surface-Container-Low (Kart Arkaplanları/Gruplar):** `#eff4ff`
- **Surface-Container-Highest:** `#d3e4fe` (Hover state veya derinlik panelleri için).

*(İstisna: Erişilebilirlik (A11y) gerektiren form girdilerinde 15% opacity ile `outline-variant` izni mevcuttur)*

## 3. Tipografi
Veri okunabilirliği ve ağırlık dengesini kurmak üzere iki font kullanılır:
- **Başlık ve Ekran Başlıkları (Manrope):** `Headline-LG (2rem)` ağırlığı geometrik ve otoriter bir görünüm sağlar.
- **Metin ve Bileşenler (Inter):** `Body-SM (0.75rem)` ile karmaşık veri tablolarında bile harika okunabilirlik sağlar.
- Arayüz taramalarını kolaylaştırmak için ana başlıklar `Semi-Bold (600)` veya üstünde kullanılmalıdır.

## 4. Renkler ve Dokular
- **Button (Primary):** Siyah `#000000` formasyonunda, ovalden (sm radius) taviz vermeyen karevari kurumsal tuşlar.
- **Cam Efekti (Backdrop Blur):** Modallar / Popover paneller `surface_container_lowest` renginde 80% Opacity + `20px backdrop-blur` efekti ile kullanılacak. 
- **Rozetler (Status Badges/Pill):** Güvenli "Approved/Opted_in" değerleri canlı yeşil yerinde koyu yeşil `secondary-container` zeminine pastel bir kontrastı barındırmalı ("Enterprise" hissiyatı).

## 5. Veri Tabloları Yönergesi
Sistem panellerdeki data display (recipients, audit events vs.) ağırlıkla tablolar üzerinden yapılacaktır. Tablo header'ı okumaya çapı "Ağırlaştırmak/Anchor" bağlamak için çok koyu lacivert `#131b2e` ile zıtlaştırılırken liste gövdesinde border çizgi değil renk şeritleri (Zebra-Striping) kullanılmalıdır.
