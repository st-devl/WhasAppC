# 🔒 Veri Gizliliği ve Rıza Politikası (Data Privacy Rulebook)

Bu belge kullanıcıların (contact) Personally Identifiable Information (PII) dedikleri hassas kişisel verilerinin WhatsApp Mesajlaşma Sistemi'nde nasıl ele alındığını açıklar. Regülasyon gereği "Rıza Modeli" birinci sınıf vatandaştır.

## 1. Consent (Rıza) Sistemi Mimarisi
- Sistem kişiye mesaj göndermek için `consent_status` değişkeninin her zaman `opted_in` durumda olmasını kontrol eder.
- Eğer bir kişinin verisi CSV vb araçlarla import edilmiş, ancak `consent_proof_url` gibi bir rıza kanıtı konulmamışsa, o kayıt `opted_in` olmaz, `pending` duruma atılır.
- **Audit İzi (Append-only):** Kullanıcı bir defa iptal (opt-out), sonra tekrar onay (opt-in) vermiş olsa dahi geçmişin logları silinmez. `consent_events` tablosunda sıralı olarak (immutable structure) insert edilir.

## 2. Kişisel Veri Kullanımı ve Görüntüleme Güvenliği
- **Maskeleme (Data Masking):** API raporlama sonuçları UI katmanında telefonların direkt gösterilmesini değil `+90 5XX XXX XX XX` şeklinde görünmesini sağlayacak maskeleme yapılarını kullanabilir. Tam görünüme ancak denetçi loguna düşürülen `actor_id` ile izin verilir.
- **Audit Logs PII De-Identification:** Yapılan işlemler için (örn. kampanya silme, kullanıcı blocklama) sistem log alır (audit_logs). Ancak bu alınan payloadlarda eğer çok hassas anahtarlar (Provider credentials vs) varsa bunlar JSON içinde maskelenir.
- **Hafıza Limitleri:** Rızanın (consent) `consent_expiry_at` ile bir son kullanma tarihi vardır. Sistem TTL'in dolduğu hiçbir aboneye, yedeği dahi olsa mesaj attırmaz.

## 3. Opt-out Ciddiyeti ve Eylemsellik
- Kullanıcı SMS, Call Center yahut Web Form vs gibi kaynaklardan Opt-out bildirimi çektiği an sistemde status Update atılır.
- Sistem aktifte olan ve `queued` durumda bekleyen ama o kullanıcıya gönderilmemiş tüm jobları "iptal" sıfatına çeker (dropped for policy).
- Duplicate engelleme mekanizmaları ve Blacklist operasyonlarında audit ve iptal sebepleri kati biçimde tutulur.
