# 📉 Karar Kayıtları (Decision Log / Architecture Log)

Bu doküman projedeki tasarımsal yön ve mimari tercihlerin nedenlerini / sonuçlarını kanıtıyla arşilemekte kullanılır.

## [Proje Başlangıcı] Mimari & Stack Tercihleri
- **Karar:** `Python + FastAPI` backend'i, Data schema validasyonları için `Pydantic v2` seçildi. Frontend arayüzünde `Vite + React`. Database: `PostgreSQL` + Background için `Redis & Celery/RQ`.
- **Neden:** Projede ağır Asenkron I/O bekleyen webhook ve provider API talepleri olacağı, Python'ın data pipeline işlerde robust kütüphaneleri ve FastAPI'nin async native yapısından yararlanılmak istenmesidir.

## [Proje Başlangıcı] Deterministik Hash & Duplicate Engeli
- **Karar:** Gönderim motoruna `message_hash` mekaniği ile deterministik (hash scope kullanımlı) bir replay/cooldown koruması konuldu.
- **Neden:** Kampanyalar sırasında aynı içeriğin/şablonun bir kullanıcıya defaatle SMS gibi ulaşmasının SPAM damgası yedirtmesi. Bu da Provider (Meta/WABA) Quality Rating metriğini anında diplere çekecektir.

## [Proje Başlangıcı] İptal ve Durdurma (Pause/Resume/Cancel) Kararları
- **Karar:** Çalışan bir kampanya pause'a alındığında sistem, memory'de olup dışarı çıkan az sayıdaki transaction bitsin diye allow verirken, sıraya yeni message girmesini kesecektir.
- **Neden:** Büyük listelerde hata bulununca hızlıca kesebilmek ve Resume edilirken sistemin tekrar consent (rıza) kurallarını, channel timeout saatlerini check update edip hatasızca gönderime baştan başlaması sağlanır.

## [Proje Başlangıcı] Webhook Idempotency & İmza Modeli
- **Karar:** Webhook route'larında body doğrudan JSON proxy'si ile decode edilemez, imza doğrulama adımları için Raw Body yakalanır.
- **Neden:** Provider'ın `X-Hub-Signature` doğrulamasının fail olma olasılığından kurtulmak ve gelen Payload id'sine istinaden "Replay Attack" / Duplike DB update akışını sıfıra indirmek.
