# 🏛️ Mimari Anayasa (Architecture & System Design)

Bu belge projenin yazılım mimarisini detaylandırır. **Clean Architecture** ve **Modüler Monolith** prensipleri esastır.

## Temel Kurallar
1. **SSOT & Modülerlik:** Domain kuralları framework'ten tamamen bağımsızdır. FastAPI sadece dış dünya ile iletişim kuran bir I/O (Input/Output) katmanıdır.
2. **Provider İzolasyonu (Sözleşmesi):** WhatsApp API sağlayıcıları "Adapter Pattern" ile sisteme dahil edilir. API mantığı provider detayını (429 handling dahil) bilmez; sadece standart bir API contract bekler (örn: `send_template_message`).
3. **Senkron/Asenkron Ayrımı:** İşlemlerin yüküne binaen, gönderim motoru (dispatcher) arka plan kuyruklarında `Celery` üzerinden asenkron işlenir. API, sadece validasyonları yapar ve job'ı kuyruğa atıp id döner.
4. **Idempotency (Replay Koruması):** Kampanya gönderimleri ve dahil olan tüm harici webhook servisleri idempotent yapıdadır. Gelen aynı webhook_id ikinci kez işlenmez, sisteme etki etmez ("replay detected" loglanır).
5. **Circuit Breaker & Polices:** Dış bağlantılardaki servislere isteklerde her zaman "timeout + retry + circuit breaker" devrede olmalıdır.

## Opt-in / Opt-out Yaşam Döngüsü (Mimarinin Odak Noktası)
- Bu ürün "izinli iletişim yöneticisi" olarak inşa edilmiştir.
- Kişiler için tek kayıt (`contacts`), ve bu kaydın geçmişini saklayan immutable tablolar (`consent_events`) vardır.
- Müşteri, `consent_status = opted_in` olmadığı müddetçe, sistem mimaride en alt seviyeden pazarlama/mesaj verisini ret eder.

## Gönderim Motoru ve Cooldown
- Sınırsız gönderilebilme (duplicity) engeli `message_hash` mekanizması kullanılarak sağlanır. (Değerler: `contact_id`, `template_id`, `normalized body`, `vars`, vb.).
- Mesaj gönderim penceresini (Sending Window) kontrol eden bir mimari oluşturulur.
- Pause ve Resume semantiği kural setleri mimarinin gönderim kuyruk yapısına dâhildir. Resume komutunda, uygunluk kuralları baştan kontrol edilirek gönderime devam edilir.
- Gönderilmesine karar verilmiş ama Provider düzeyinde fail olmuş network bağlantıları "Reconciliation Worker" (uzlaşma işcisi) tarafından idare edilir.

## Loglama ve Telemetri Mimarisi
- Her kritik iş akışı (action) `audit_logs` tablosunu besler.
- `correlation_id` request anından itibaren, middleware'ler ile yakalanır, db işlemleri üzerinden geçerek workerlara devredilir.
