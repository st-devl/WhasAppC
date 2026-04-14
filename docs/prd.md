# WhatsApp İzinli Müşteri Mesajlaşma Sistemi — Senior+ Production Master Prompt

Bu uygulama, açık rıza vermiş müşterilere resmi WhatsApp altyapısı üzerinden toplu, kontrollü, güvenli, denetlenebilir ve profesyonel mesaj gönderimi yapılmasını sağlayan bir web uygulamasıdır.

Uygulamanın temel amacı:

- Mesaj şablonlarını yönetmek
- Kampanyalar oluşturmak ve zamanlamak
- Gönderim sonuçlarını izlemek
- Provider webhook olaylarını görmek
- Tüm kritik işlemleri audit log ile izlemek
- Kanal sağlığını kontrol etmek
- Test gönderimleri ile gerçek kampanya gönderimlerini birbirine karıştırmadan yönetmek

Bu ürün; güven, kontrol, resmiyet, operasyon kolaylığı ve mevzuat uyumu hissi vermelidir.
Arayüz asla spam aracı gibi görünmemeli.
Asla agresif pazarlama paneli hissi vermemeli.
Daha çok:
- kurumsal mesaj operasyon merkezi
- izinli iletişim yönetim platformu
- denetlenebilir iletişim kontrol paneli
gibi görünmelidir.

Tasarım dili şu duyguları vermeli:
- resmi
- güvenilir
- ciddi
- premium
- sade
- hızlı
- takip edilebilir
- veri odaklı
- denetlenebilir
- modern



## Amaç
Açık rıza vermiş alıcılara, resmi ve sürdürülebilir bir altyapı üzerinden WhatsApp mesajları gönderen, yüksek performanslı, güvenilir, denetlenebilir ve mevzuat uyumlu bir web uygulaması geliştir.

Sistem kesinlikle:
- Resmi WhatsApp Business Platform veya onaylı BSP kullanmalı
- Yalnızca açık rıza (opt-in) bulunan kişilere gönderim yapmalı
- Opt-out taleplerini anında uygulamalı
- Duplicate gönderimi önlemeli
- Tüm iş akışlarında audit, idempotency, replay koruması ve operability içermeli
- Production-grade olmalı

---

# 1. Teknoloji Yığını

## Backend
- Python 3.12+
- FastAPI
- SQLAlchemy 2.x
- Pydantic v2
- Alembic

## Veritabanı
- PostgreSQL 16+
- Redis

## Arka Plan İşleri
- Celery veya RQ
- Redis broker
- Kalıcı kuyruk zorunlu

## Frontend
- React + TypeScript
- Vite
- TanStack Query
- Zod

## Gerçek Zamanlı Katman
- Dashboard için SSE
- Yalnızca gerçekten çift yönlü ihtiyaç varsa WebSocket

## Depolama
- S3 uyumlu obje depolama
- Medya için SHA256 hash
- MIME doğrulama

## Gözlemlenebilirlik
- Structured logging
- Prometheus
- OpenTelemetry
- Sentry

---

# 2. Mimari İlkeler

- Clean architecture veya modüler monolith yaklaşımı uygula
- Domain kuralları framework’ten bağımsız olsun
- Idempotent job execution zorunlu
- Her dış servis çağrısında timeout + retry policy + circuit breaker kullan
- Timezone-aware datetime zorunlu
- Varsayılan timezone: Europe/Istanbul
- Üretimde SQLite kullanılmaz
- Her kritik iş akışı audit log üretir
- Her webhook, job, campaign ve provider event correlation_id taşır

---

# 3. Opt-in / Opt-out Yaşam Döngüsü (KRİTİK)

Sistem rıza yönetimini birinci sınıf vatandaş olarak ele almalı.

## Consent Alanları
contacts tablosunda:
- consent_status: none | pending | opted_in | opted_out | expired | revoked
- consent_source: sms | web_form | call_center | manual_import | api | in_store | unknown
- consent_text_version
- consent_proof_url
- consent_timestamp
- consent_expiry_at
- opt_out_timestamp
- opt_out_source
- opt_out_reason

## Kurallar
- consent_status = opted_in olmayan kişilere pazarlama mesajı gönderilmez
- opted_out kişi tekrar mesaj alamaz
- opted_out kişinin tekrar opted_in olması yalnızca yeni ve doğrulanabilir rıza kaydı ile mümkündür
- manuel güncelleme audit log’a tam ayrıntılı düşmelidir
- consent sonsuz kabul edilmez; consent_expiry_at desteklenmelidir
- expiry dolmuşsa consent_status otomatik expired olur
- expired kişi yeni opt-in vermeden tekrar hedeflenemez
- CSV import ile gelen consent kayıtlarında zorunlu alanlar:
  - consent_source
  - consent_timestamp
  - consent_text_version
  - consent_proof_url veya proof_reference
- proof bulunmayan kayıtlar opted_in sayılmaz; pending veya none olarak işaretlenir
- opt-out alındığında bekleyen ve henüz provider’a teslim edilmemiş gönderimler iptal edilir

## Audit
Ayrı consent_events tablosu oluştur:
- id
- contact_id
- event_type: opt_in | opt_out | expiry | revoke | renew
- source
- proof_reference
- note
- actor_id nullable
- created_at

Bu tablo immutable olmalı; geçmiş rıza hareketleri güncellenmemeli, yalnızca yeni event eklenmeli.

---

# 4. Veri Modeli

## contacts
- id PK
- first_name
- last_name
- phone_e164 UNIQUE
- country_code
- consent_status
- consent_source
- consent_text_version
- consent_proof_url
- consent_timestamp
- consent_expiry_at
- opt_out_timestamp
- opt_out_source
- opt_out_reason
- tags JSONB
- is_blacklisted BOOLEAN
- blacklist_reason
- created_at
- updated_at

## consent_events
- id PK
- contact_id FK
- event_type
- source
- proof_reference
- note
- actor_id nullable
- created_at

## templates
- id PK
- name
- channel
- template_type
- locale
- body
- variables_schema JSONB
- approval_status
- provider_template_id
- last_synced_at
- created_at
- updated_at

## campaigns
- id PK
- name
- template_id FK
- status
- audience_type
- scheduled_at
- sending_window_start
- sending_window_end
- timezone
- cooldown_policy_id FK nullable
- test_mode BOOLEAN DEFAULT false
- created_by
- created_at
- updated_at

## campaign_recipients
- id PK
- campaign_id FK
- contact_id FK
- personalized_payload_json JSONB
- message_hash
- hash_scope
- duplicate_cooldown_until
- status
- provider_message_id
- provider_conversation_id
- retry_count
- sent_at
- delivered_at
- read_at
- failed_at
- failure_code
- failure_reason
- created_at
- updated_at

## media_assets
- id PK
- template_id FK nullable
- campaign_id FK nullable
- storage_key
- original_name
- mime_type
- sha256
- size_bytes
- created_at

## channel_accounts
- id PK
- provider_name
- sender_identifier
- business_profile_json JSONB
- quality_rating
- messaging_limit_tier
- is_active
- health_status
- last_health_check_at
- created_at
- updated_at

## webhooks_inbox
- id PK
- provider
- webhook_id
- event_type
- signature_valid
- replay_detected
- received_at
- processed_at
- payload_json JSONB
- processing_status
- failure_reason
- created_at

Kurallar:
- UNIQUE(provider, webhook_id)
- received_at zorunlu
- 5 dakikadan eski ve replay korumasını geçemeyen webhook işlenmemeli

## audit_logs
- id PK
- actor_id
- entity_type
- entity_id
- action
- before_json JSONB
- after_json JSONB
- ip_address
- correlation_id
- created_at

## cooldown_policies
- id PK
- name
- scope: global | per_campaign | per_template | per_contact_template
- duration_minutes
- created_at

---

# 5. Provider Adapter Sözleşmesi

Provider adapter katmanı business logic’ten tamamen izole edilmeli.

Aşağıdaki interface’i tanımla:

- send_template_message(payload)
- upload_media(file)
- get_message_status(message_id)
- validate_webhook(signature, headers, raw_body)
- health_check()
- list_approved_templates()
- get_business_profile()
- handle_rate_limit_response(response)
- normalize_provider_error(error)
- parse_webhook_event(payload)
- reconcile_message_status(message_id)

Kurallar:
- 429 ve provider throttling mantığı adapter içinde yönetilmeli
- service katmanı provider’a özgü rate-limit detaylarını bilmemeli
- provider şablon listesini sync eden periyodik job yazılmalı
- provider business profile ve kalite bilgisi düzenli çekilmeli

---

# 6. Template Yönetimi

Kurallar:
- approval_status = approved olmayan şablon gönderimde kullanılamaz
- provider_template_id olmayan kayıtlar aktif kampanyada kullanılamaz
- provider’dan onaylı template sync mekanizması olmalı
- template preview endpoint’i gerçek payload ile render göstermeli
- değişken doğrulama zorunlu

Desteklenen değişkenler:
- {{first_name}}
- {{last_name}}
- {{full_name}}
- {{custom.*}}

Not:
Rastgele varyasyon, tespit atlatma, spintax veya anti-detection davranışı kurulmayacak.
Resmi sağlayıcının ve onaylı şablon modelinin izin verdiği yapı esas alınacak.

---

# 7. Campaign ve Test Gönderimi Semantiği

## Campaign Durumları
- draft
- scheduled
- queued
- sending
- paused
- completed
- partially_failed
- failed
- cancelled

## Test Gönderimi (NET TANIM)
Test gönderimi ayrı akış olmalı; gerçek campaign gönderiminden farklı ele alınmalı.

Kurallar:
- test gönderimi yalnızca sistemde “test recipient” yetkisi verilmiş numaralara yapılabilir
- test recipient listesi ayrı tablo veya ayar nesnesinde tutulmalı
- test gönderimi audit log’a düşmeli
- test gönderimi gerçek raporlama metriklerine karışmamalı
- test gönderimi campaign_recipients tablosuna yazılabilir ama `is_test=true` ile ayrılmalı
- test gönderimi varsayılan olarak sending window kuralından muaftır, ancak rate limit ve policy validation’dan muaf değildir
- test gönderiminde de consent kontrolü yapılmalıdır, aksi yazılı olarak istenmedikçe bypass edilmez
- test modunda provider_message_id, hata ve webhook akışı yine kaydedilmelidir

## Test Recipient Tablosu
- id
- phone_e164
- label
- is_active
- created_at

---

# 8. Duplicate Önleme ve message_hash Tanımı

message_hash muğlak bırakılmayacak.

## Hash Bileşenleri
Deterministik hash şu alanlardan üretilmeli:
- contact_id
- template_id
- normalized rendered body
- normalized variable payload
- sorted media asset sha256 listesi
- hash_scope identifier
- cooldown bucket key

## Hash Scope
Aşağıdaki modlardan biri seçilebilir:
- global
- per_campaign
- per_template
- per_contact_template

Varsayılan öneri:
- per_contact_template

## Cooldown Kuralı
Cooldown süresi configurable olmalı.
Örnek:
- varsayılan 1440 dakika
- aynı contact + template kombinasyonuna cooldown bitmeden aynı içerik tekrar gönderilemez

## İş Kuralı
- farklı campaign olsa bile, hash_scope ve cooldown politikasına göre duplicate engeli çalışmalıdır
- aynı kişiye aynı şablonu 1 saat arayla yollamak isteniyorsa bu ancak cooldown policy bunu izin veriyorsa mümkün olmalı
- duplicate engellendiğinde recipient status = skipped_duplicate olmalı ve audit log yazılmalı

---

# 9. Pause / Resume Semantiği

Pause ve resume davranışı net tanımlanmalı.

## Pause
Pause istendiğinde:
- henüz provider’a dispatch edilmemiş queued işler beklemeye alınır
- aktif olarak provider’a gönderim aşamasında olan çok az sayıdaki in-flight kayıt tamamlanabilir
- yeni dispatch yapılmaz
- campaign status = paused olur

## Resume
Resume istendiğinde:
- queued ve waiting kayıtlar yeniden eligibility kontrolünden geçer:
  - consent hâlâ geçerli mi
  - blacklist değişti mi
  - cooldown ihlali oluştu mu
  - sending window uygun mu
  - kanal hesabı sağlıklı mı
- eligibility’yi kaybedenler skipped_policy veya skipped_consent olarak işaretlenir
- kalanlar yeniden kuyruğa alınır

## Cancel
Cancel istendiğinde:
- henüz gönderilmemiş queued kayıtlar iptal edilir
- in-flight işlemler completion sonrası yeniden dispatch edilmez
- campaign status = cancelled olur

---

# 10. Webhook Güvenliği ve İdempotency

Webhook işleme katmanı çok sıkı olmalı.

## Zorunlu Kurallar
- ham request body ile signature doğrulaması yapılmalı
- signature geçersizse:
  - işlenmez
  - security log yazılır
  - alarm metriği artar
- provider webhook retry ihtimaline karşı webhook_id saklanmalı
- UNIQUE(provider, webhook_id) zorunlu
- aynı webhook tekrar gelirse replay_detected = true olarak loglanmalı ve idempotent ignore edilmeli
- received_at kaydedilmeli
- max age kontrolü uygulanmalı; örnek 5 dakikadan eski webhook policy’ye göre reddedilmeli veya low-trust queue’ya alınmalı
- webhook parse edilemezse dead-letter veya manual review queue’ya yönlendirilmeli

## Webhook İşleme Akışı
1. raw body al
2. signature doğrula
3. timestamp/max age doğrula
4. webhook_id duplicate kontrolü yap
5. inbox tablosuna yaz
6. parse et
7. campaign_recipients veya channel_accounts güncelle
8. audit/metrik/log üret
9. processed_at yaz

---

# 11. Kanal Hesap Sağlığı

Campaign başlamadan önce account health check yapılmalı.

## Kontroller
- API credentials geçerli mi
- sender aktif mi
- business profile erişilebilir mi
- quality rating kabul edilebilir mi
- messaging limit tier uygun mu
- son health check tarihi güncel mi
- provider 429 veya suspension sinyali veriyor mu

Health kötü ise:
- yeni campaign start edilmez
- aktif campaign pause edilebilir
- kullanıcıya görünür alarm üretilir

---

# 12. Gönderim Motoru

## Akış
1. campaign doğrula
2. template approval kontrol et
3. account health kontrol et
4. sending window kontrol et
5. consent ve blacklist filtrelerini uygula
6. payload render et
7. message_hash üret
8. duplicate policy kontrol et
9. recipient oluştur veya güncelle
10. kuyruğa al
11. provider adapter ile gönder
12. provider acceptance cevabını kaydet
13. webhook veya reconciliation ile son durumları işle
14. SSE ile dashboard’a event yayınla

## Retry Politikası
- yalnızca transient error’larda retry
- provider accepted ise retry yok
- network timeout durumunda reconciliation öncelikli
- exponential backoff + jitter
- dead-letter queue zorunlu
- her retry audit log’a düşmeli

## Reconciliation Worker
Ayrı worker yaz:
- accepted olup webhook gelmeyen kayıtları tarar
- provider_message_id ile son durum sorar
- duplicate retry riskini azaltır

---

# 13. Sending Window ve Politika Motoru

Varsayılan:
- timezone: Europe/Istanbul
- sending_window_start: 09:00
- sending_window_end: 21:00

Kurallar:
- pencere dışında dispatch yapılmaz
- resume sırasında yeniden kontrol edilir
- test mode için pencere bypass edilebilir ama rate limit uygulanır
- contact bazlı locale/timezone desteği genişletilebilir

---

# 14. Realtime Mimarisi

Dashboard için tek SSE endpoint kullan:
- GET /api/events/stream

Event tipleri:
- campaign.updated
- recipient.updated
- webhook.received
- health.updated
- import.completed
- consent.updated

Frontend birden fazla job için ayrı soket açmamalı.
Tek stream almalı, client-side event filtering yapmalı.

---

# 15. API Tasarımı

## Contacts
- GET /api/contacts
- POST /api/contacts
- PUT /api/contacts/{id}
- DELETE /api/contacts/{id}
- POST /api/contacts/import
- GET /api/contacts/export
- POST /api/contacts/{id}/opt-in
- POST /api/contacts/{id}/opt-out
- POST /api/contacts/{id}/blacklist
- POST /api/contacts/{id}/unblacklist

## Consent
- GET /api/contacts/{id}/consent-events

## Templates
- GET /api/templates
- POST /api/templates
- PUT /api/templates/{id}
- DELETE /api/templates/{id}
- POST /api/templates/{id}/preview
- POST /api/templates/sync-provider

## Campaigns
- GET /api/campaigns
- POST /api/campaigns
- GET /api/campaigns/{id}
- POST /api/campaigns/{id}/schedule
- POST /api/campaigns/{id}/start
- POST /api/campaigns/{id}/pause
- POST /api/campaigns/{id}/resume
- POST /api/campaigns/{id}/cancel
- POST /api/campaigns/{id}/test-send
- GET /api/campaigns/{id}/recipients
- GET /api/campaigns/{id}/report

## Channel Accounts
- GET /api/channel-accounts
- POST /api/channel-accounts/health-check
- POST /api/channel-accounts/sync-profile

## Webhooks
- POST /api/webhooks/{provider}

---

# 16. Frontend Gereksinimleri

Sayfalar:
- Dashboard
- Contacts
- Consent History
- Templates
- Campaigns
- Campaign Detail
- Media
- Channel Health
- Audit Logs
- Settings

Campaign Detail sayfasında göster:
- recipient status breakdown
- duplicate skip sayısı
- consent skip sayısı
- retry sayısı
- webhook gecikme metriği
- account health badge
- test send kayıtları

---

# 17. Güvenlik ve Uyum

- Opt-in kanıtı olmadan pazarlama gönderimi yok
- Opt-out anında uygulanmalı
- Consent expiry zorunlu
- Veri saklama süresi politikası tanımlanmalı
- Kişisel veriler maskelenmiş gösterilebilmeli
- Erişim ve değişiklikler audit log’a düşmeli
- Webhook replay ve signature koruması olmalı
- Secrets secret manager üzerinden yönetilmeli

---

# 18. Gözlemlenebilirlik

Metrikler:
- campaign_send_attempt_total
- campaign_send_success_total
- campaign_send_failure_total
- duplicate_prevented_total
- consent_rejected_total
- webhook_invalid_signature_total
- webhook_replay_detected_total
- webhook_lag_seconds
- provider_latency_ms
- queue_depth
- retry_total
- campaign_paused_total

Loglar:
- JSON structured logs
- correlation_id zorunlu
- webhook_id, provider_message_id ve campaign_id taşınmalı

---

# 19. Test Stratejisi

Yaz:
- unit tests
- integration tests
- contract tests
- webhook security tests
- idempotency tests
- duplicate prevention tests
- consent lifecycle tests
- cooldown policy tests
- pause/resume semantic tests
- sending window tests
- reconciliation tests

Zorunlu senaryolar:
- opt-out sonrası queued mesajların iptali
- expired consent ile gönderim reddi
- CSV import’ta proof olmayan kaydın opted_in sayılmaması
- aynı webhook’un iki kez gelmesi
- invalid signature webhook’un işlenmemesi
- pause sonrası resume’da eligibility’nin yeniden hesaplanması
- cooldown aktifken duplicate’in skip edilmesi
- test send’in ana campaign metriklerini kirletmemesi

---

# 20. Beklenen Çıktı

Kod ve mimari şu özelliklere sahip olmalı:
- production-grade
- policy-compliant
- duplicate-safe
- webhook-idempotent
- consent-lifecycle-aware
- audit-friendly
- yüksek performanslı
- ölçeklenebilir
- test edilebilir
- operable

Kod üretirken demo mantığıyla değil, staff-level backend ve systems design kalitesinde düşün.
Özellikle şu konular birinci sınıf vatandaş olsun:
- consent lifecycle
- webhook security
- idempotency
- cooldown policy
- pause/resume semantics
- reconciliation
- observability



# Design System Specification: High-Performance Enterprise Connectivity

## 1. Overview & Creative North Star
The Creative North Star for this system is **"The Architectural Ledger."** 

In the world of high-stakes WhatsApp Business management, clarity is authority. This system moves away from the "bubbly" consumer nature of messaging apps and repositions the platform as a serious enterprise tool—akin to a high-end financial terminal or a premium CRM. We achieve this through "Architectural Layering": using structural depth and tonal shifts rather than lines to define space. The aesthetic is rigorous, spacious, and unapologetically professional.

### Breaking the Template
To avoid the "generic SaaS" look, we utilize:
- **Intentional Asymmetry:** Aligning data-heavy modules with generous, off-center white space to allow the eye to rest.
- **Typographic Scale:** Using a dramatic contrast between the high-character Manrope headers and the utilitarian Inter body text.
- **Tonal Depth:** Replacing 1px borders with tiered background colors to create a "nested" physical reality.

---

## 2. Colors & Surface Logic
The palette is rooted in stability and trust, utilizing Deep Slates and sophisticated Neutrals.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Physical boundaries must be defined solely through background color shifts. For example, a `surface-container-low` side panel sitting on a `surface` background provides all the definition needed without the visual "noise" of a line.

### Surface Hierarchy (The Layering Principle)
Treat the UI as a series of stacked sheets. Use these tokens to define depth:
- **Surface (Base):** `#f8f9ff` – The canvas.
- **Surface-Container-Lowest:** `#ffffff` – Used for primary content cards to make them "pop."
- **Surface-Container-Low:** `#eff4ff` – Used for secondary grouping or background regions.
- **Surface-Container-Highest:** `#d3e4fe` – Used for active states or deeply nested utility panels.

### Signature Textures
- **The Glass Effect:** For floating elements (Modals, Popovers), use `surface_container_lowest` at 80% opacity with a `20px` backdrop-blur. This softens the interface and makes the system feel integrated rather than "pasted on."
- **Status Sophistication:** Use `secondary` (Emerald Green) for "Opted-in" statuses, but pair it with `on-secondary-container` text to ensure high-contrast professional legibility.

---

## 3. Typography
We utilize a dual-font strategy to balance character with high-performance readability.

*   **Display & Headlines (Manrope):** Chosen for its modern, geometric structure. Use `Headline-LG` (2rem) for dashboard titles to establish an editorial feel.
*   **Body & Labels (Inter):** The workhorse. Inter’s tall x-height ensures that even at `Body-SM` (0.75rem), complex data tables remain perfectly legible.

**Hierarchical Weighting:** Always use a `Semi-Bold` (600) or `Bold` (700) weight for `Title-SM` to anchor card headers, contrasted against `Regular` (400) body text. This creates an immediate "scan-path" for the user.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** and **Ambient Light**, not structural outlines.

*   **Ambient Shadows:** When a shadow is required (e.g., a floating Action Button), use a highly diffused shadow: `0 8px 32px rgba(11, 28, 48, 0.06)`. Note the color: we use a tint of `on-surface` (#0b1c30) rather than pure black to keep the shadow feeling "airy."
*   **The Ghost Border:** If a container absolutely requires a boundary for accessibility, use the `outline-variant` token at **15% opacity**. It should be felt, not seen.
*   **Active States:** Instead of a border, an active sidebar item or tab should be indicated by a shift to `surface-container-highest` and a `primary` (Black) vertical pill indicator.

---

## 5. Components

### Cards & Modules
Forbid the use of divider lines. Separate card sections using a change from `surface-container-lowest` to `surface-container-low` or by utilizing the **Spacing Scale** (minimum 24px padding between logical groups).
- **Corner Radius:** Use `md` (12px) for main containers and `sm` (4px) for smaller internal elements like input fields.

### Professional Data Tables
- **Header:** Use `primary-container` (#131b2e) for the header background with `on-primary` text. This provides a "heavy" anchor for the data below.
- **Rows:** Alternate between `surface` and `surface-container-low` for zebra-striping. Never use line dividers.

### Buttons
- **Primary:** `primary` (#000000) background with `on-primary` text. Square-ish (`sm` radius) to convey seriousness.
- **Secondary:** Transparent background with a `Ghost Border`.
- **Tertiary:** Text-only, using `on-surface-variant` for a subtle, high-end feel.

### Status Badges (Sleek Badges)
Use a pill shape (`full` roundedness). For "Approved," use `secondary-container` with `on-secondary-container` text. The color must be desaturated enough to feel "Enterprise," not "Consumer."

### Connectivity Indicators
A custom component for this platform: A "WhatsApp Signal" indicator using `secondary` (Emerald) for connected and `error` for disconnected, paired with a `surface-container-highest` pulse animation.

---

## 6. Do’s and Don’ts

### Do:
- **Do** use whitespace as a functional tool. If a screen feels cluttered, increase the gutter between containers rather than adding lines.
- **Do** use `on-surface-variant` for helper text to maintain a sophisticated hierarchy.
- **Do** ensure all "Opt-in" actions are highlighted with the `secondary` Emerald Green to reinforce positive platform health.

### Don't:
- **Don't** use 100% black for text; use `on-surface` (#0b1c30) to keep the "Navy/Slate" sophisticated tone.
- **Don't** use playful icons. Use high-stroke-weight, minimalist line icons (2px stroke) that feel architectural.
- **Don't** use standard shadows. If it looks like a "drop shadow," it's too heavy. It should look like "ambient glow."