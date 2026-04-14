# 🧠 Yapay Zeka Hafızası ve Bağlam (Project Memory)

Bu doküman Antigravity (Agent) veya asistan zeka modellerinin projeye her girdiği an referans alacağı kalıcı ezber dosyasıdır. Kurallar ve proje kısıtlamaları burada listelenir.

## Projenin Temel Doğası (Context)
- Müşteri kurumsal ve ağırbaşlı, "SPAM aracına" asla benzemeyen (Data-Driven bir mesaj gönderim üssü gibi) **WhatsApp İzinli Müşteri Mesajlaşma Sistemi** inşa etmektedir.
- Kurulan yapı WhatsApp Business API (WABA) veya BSP Entegrasyonlarına dayalı, onaylı şablonlarla kişilere mesaj dispatch etmek üzere kurgulanmıştır.

## Bilinmesi Gereken Özel Kesin Kurallar!
1. **Consent-Driven Development:** Mimaride "Rıza (Consent)" sadece bir bilgi kolonu değil, tüm gönderimin `opted_in` şartı ile bağlandığı ana anahtardır. Asla proof of consent yoksa test harici kişiye payload üretilemeyecektir.
2. **Reconciliation (Uzlaşma):** Mesaj API aracından çıksa dahi kabul durumu için webhook beklenir. Uzayda kaybolan data durumu için webhook gecikmesinde çalışacak ve durumu eşitlemek için Provider'a soracak bir Asenkron Job yazılacaktır.
3. **The No-Line Rule (UI):** Frontend UI implementasyonlarında modal bölmeleri, section ayrımları veya kenarlar 1px solid çizgi border ile ASLA DEĞİL; elementlerin arka plan gradient katman değişikliği (Surface - Lowest - Low - Highest hiyerarşisi) uygulanarak sınırlandırılacaktır.
4. **Idempotency & Replay:** Gelen webhook paketleri DB id/webhook_id sayesinde tekrar gelirse (Ağ problemi vb) `replay_detected` tetikler, database bozmadan sisteme yansır. İş kuyruğu (Workers) ve DB Migrationları her zaman idempotent olmalıdır.
5. **Test Modeli:** "Normal kampanya ile test kampanya metrikleri mix edilmez." Testler, sistem üzerinde `is_test=true` yetkili recipient/contact kişileri ile yapılandırılır.

## Agent Notu (Kısayol)
Bu proje MVP (Minimum Viabilir Süreç) konseptinden çok "Senior+ ve Enterprise seviyesi mimari" odaklıdır. Oluşturulan tüm DB schema planları, backend kodları rate limitleri gözeten policy yapısıyla desteklenmek zorundadır.

**Son Güncelleştirilme:** 2026-04-13
