# 🚀 Proje Genel Özeti (Project Brief)

**Proje Adı:** WhatsApp İzinli Müşteri Mesajlaşma Sistemi
**Tip:** B2B SaaS / Enterprise Panel
**Temel Teknolojiler:** Python (FastAPI), React, PostgreSQL, Redis, Celery.

**Hedef Kitle & Temel Vizyon:**
- Bu sistem, firmalar ve işletmelerin açık rızasını "opt-in" olarak topladıkları müşterilerine, resmi WhatsApp Business Altyapısı (veya onaylı bir BSP) aracılığıyla toplu, güvenilir, denetlenebilir, SPAM hissi olmayan profesyonel yayınlar (kampanyalar) yapmasını sağlar.
- Sistem; agresif bir pazarlama paneli olarak değil, "Kurumsal İletişim Yönetimi Platformu" edasıyla hareket etmeli, kullanıcılarına hukuki denetimi (audit) ve teknik stabilitesi yüksek bir deneyim yaşatmalıdır.

**Temel Özellikler (Core Features):**
1. **İzin ve Rıza (Consent) İdaresi:** Kullanıcılar veritabanına sadece bir CSV ile içeri alınmazlar; her kontakt proof, rıza metin versiyonu ve expiry ile birlikte değerlendirilir. Opt-out eklendiğinde bekleyen iş iptal olur.
2. **Kanal ve Sağlık İzleme (Channel Health):** Meta veya hizmet sağlayıcıdan sürekli olarak işletme profili durumu ve "messaging limit tier" çekilerek hesap sağlığı doğrulanır, rating'ler sisteme yansıtılır.
3. **Kampanya (Campaign) Dispatching:** Hedeflenen şablonlarla kişiselleştirilmiş (variables) binlerce mesaj, Duplicate/Cooldown denetimleri kullanılarak sorunsuzca alıcılara iletilir.
4. **Webhook Kontrol Merkezi:** Provider tarafındaki Delivery, Read, Failed raporları ile Error / 429 webhookları idare edilir. Kriptografik imza kullanılmadan hiçbir dış payload kabul edilmez.
5. **Real-Time Analytics Dashboard:** SSE kullanarak platform üzerindeki metrikler canlı olarak son kullanıcı grafiklerine iletilir. Gönderi başarı oranı, Consent reddi sayısı, Retry adetleri gibi teknik göstergeler dahil edilir.

**Genel Mühendislik Standartı:**
- Kurulacak olan sistem %100 "Senior / Staff-level production" hedefine tasarlanmıştır. Bu bağlamda, transient error management, circuit breaking, deterministic hashing (hash scope ile), dead-letter kuyrukları vb. konular "nice to have" değil, zorunlu projelendirme konularıdır.
