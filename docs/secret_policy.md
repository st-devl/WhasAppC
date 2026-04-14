# 🔑 Güvenlik & Secret Yönetim Politikası (Secret Policy)

Projenin güvenlik unsurları ve çevresel ayarlarının (Environment/Secrets) idare biçimi kuralları. Bu doküman Olası Veri İhlali riskini minimize eder.

## 1. Credentials Hiyerarşisi
- Veritabanı URL'leri, Redis Token'lar, Secret Key (JWT/Session hashing için) veya harici Provider (Meta/WABA) API anahtarları asla repository içerisindeki dosyalarda hard-coded yer alamaz!
- Tüm veriler CI/CD süreçlerinden dışlanmış, sisteme container seviyesinde environment (.env) veya Secret Manager (AWS Secrets Manager / Vault) hizmetleri ile sunululmalıdır.

## 2. Webhook Güvenliği (Kritik Koruma)
Sistemde sadece içeriden dışarıya değil, dışarıdan da sistem verisini provoke edebilecek webhook mimarisi bulunur.
Zorunlu Koruma Yüzeyleri:
- **Signature (İmza) Doğrulaması:** Meta/Provider gelen requestlerinin ham (raw/Byte) bodysi ve headers kısmındaki SHA256/SHA1 şifreleri uygulamada match etmezse `Security Error` loglanır ve body tamamen parse dahi edilmeden `403/401` dönülür.
- **Idempotency (Replay Koruması):** Webhook payloadları içinde gelen `webhook_id`. Sistem DB de bunu UNIQUE constraint ile kontrol eder. İstek aynı gelirse duplicate yapmamak için id'yi fark edip `replay_detected: true` yapıp başarılı döner ancak backend state değiştirmez.
- **Max Age / Time Drift Kontrolü:** İlgili webhook paketi belirli bir max-age'den (Örn. 5 dakika) eskiyse (timestamp üzerinden), provider delay kabul edilip low-trust log kuyruğuna aktarılır. Bu da "Reply attack" engeller.

## 3. Güvenlik Loglaması ve Audit
- Uygulama üzerinde yetkisi olan yöneticilerin her CRUD eylemi, kimin (actor_id), nereyi, (entity_type/id), ne zamandan ne zamana değiştirdiği (before_json > after_json) açıkça yazılarak silinemez şekilde audit loglarına yansıtılacaktır.
- API Endpointlerinde ve Rate-Limit işlemlerinde koruma uygulanacak, proxy header'ları okuyan (X-Forwarded-For) sistemler istismar edilemeyecektir.

## 4. Secret Manager Stratejisi
- Production ortamında `SECRET_KEY`, `AUTH_*_API_KEY`, `DATABASE_URL`, `REDIS_URL`, `CELERY_*`, `PROVIDER_API_KEY` ve `PROVIDER_WEBHOOK_SECRET` değerleri doğrudan Secret Manager üzerinden enjekte edilmelidir.
- Desteklenen operasyonel strateji: `SECRET_MANAGER_PROVIDER` ile sağlayıcı adı (`aws-secrets-manager`, `vault`, `gcp-secret-manager`, `azure-key-vault` veya `external`) ve `SECRET_MANAGER_SECRET_PATH` ile secret path tanımlanır.
- Kod, production ortamında `SECRET_KEY` placeholder kalırsa ve `AUTH_ENABLED=true` yapılmazsa uygulamayı başlatmaz. Bu kontrol bilerek fail-fast çalışır.
- `.env.example` sadece local geliştirme şablonudur; gerçek credential, token, provider secret veya connection string bu dosyaya yazılamaz.

## 5. Veri Saklama Politikası
- Audit log kayıtları varsayılan 365 gün tutulur: `AUDIT_LOG_RETENTION_DAYS`.
- Webhook inbox kayıtları varsayılan 90 gün tutulur: `WEBHOOK_INBOX_RETENTION_DAYS`.
- Çözülmüş dead-letter kayıtları varsayılan 180 gün tutulur: `DEAD_LETTER_RETENTION_DAYS`.
- Periyodik temizlik worker task adı `retention.purge_expired` olarak tanımlıdır ve scheduler/beat üzerinden günlük çalıştırılmalıdır.
