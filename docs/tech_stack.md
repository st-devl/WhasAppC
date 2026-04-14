# 🛠️ Tech Stack ve Teknoloji Kararları

Bu belge, WhatsApp İzinli Müşteri Mesajlaşma Sistemi'nin teknoloji yığınını tanımlar. Seçimler "Kurumsal" ve "Production-Grade" önceliklendirilerek yapılmıştır.

## Backend (API & Worker)
- **Dil:** Python 3.12+ (Type-safety ve modern sentaks için)
- **Framework:** FastAPI (Yüksek performans, async native, auto validasyon)
- **Veritabanı:** PostgreSQL 16+ (Reliability, Partitioning desteği)
- **ORM:** SQLAlchemy 2.x (Enterprise object mapping)
- **Schema & Validasyon:** Pydantic v2 (Rust tabanlı hızlı validasyon)
- **Migration:** Alembic
- **Background Jobs:** Celery veya RQ (Kalıcı kuyruk Redis ile)

## Frontend (Dashboard)
- **Dil:** TypeScript (Tip güvenliği için zorunlu)
- **Framework:** React + Vite (Hızlı HMR, SPA)
- **Data Fetching:** TanStack Query (Server state management, caching)
- **Validasyon:** Zod (Type-safe formlar ve API response'ları)
- **Gerçek Zamanlı İletişim:** SSE (Server-Sent Events) ile tek yönlü dashboard update, çift yönlü ihtiyaç olursa WebSocket eklenebilir.
- **Stil Yönetimi:** Tailwind CSS (Projenin tasarım sistemine (no-line rule) uygun özelleştirilmiş container sınıflarıyla)

## Altyapı & Depolama
- **Cache & Broker:** Redis (Celery broker ve session/cooldown yönetimi)
- **Nesne Depolama:** S3 uyumlu storage (Medyalar SHA256 ile hashlenerek, MIME doğrulamalı saklanır)

## Gözlemlenebilirlik (Observability)
- **Logging:** Structured JSON logging (Her log `correlation_id` içermelidir)
- **Metrikler:** Prometheus endpoint'leri
- **Tracing:** OpenTelemetry
- **Hata Takibi:** Sentry
