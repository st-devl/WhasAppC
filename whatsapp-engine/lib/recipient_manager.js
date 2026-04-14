const fs = require('fs-extra');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/recipient_history.json');
const STATS_PATH = path.join(__dirname, '../data/daily_stats.json');

/**
 * Alıcı geçmişini, günlük limitleri ve temizlik operasyonlarını yöneten katman.
 */
class RecipientManager {
    constructor() {
        this.history = {};
        this.stats = { date: new Date().toLocaleDateString('tr-TR'), count: 0 };
        this.init();
    }

    async init() {
        try {
            await fs.ensureDir(path.dirname(DB_PATH));
            
            // Alıcı Geçmişi
            if (await fs.pathExists(DB_PATH)) {
                this.history = await fs.readJson(DB_PATH);
            } else {
                await fs.writeJson(DB_PATH, {});
            }

            // Günlük İstatistikler
            if (await fs.pathExists(STATS_PATH)) {
                const savedStats = await fs.readJson(STATS_PATH);
                const today = new Date().toLocaleDateString('tr-TR');
                if (savedStats.date === today) {
                    this.stats = savedStats;
                } else {
                    // Yeni gün, sayacı sıfırla
                    this.stats = { date: today, count: 0 };
                    await this.saveStats();
                }
            } else {
                await this.saveStats();
            }

            // Başlatıldığında eski kayıtları temizle
            await this.cleanup();
        } catch (err) {
            console.error('RecipientManager Init Hatası:', err);
        }
    }

    async saveStats() {
        await fs.writeJson(STATS_PATH, this.stats);
    }

    /**
     * Bugün gönderilen toplam mesaj sayısını döner.
     */
    getDailyCount() {
        // Tarih kontrolü (Gece yarısından sonra uygulama açıksa sayacı sıfırla)
        const today = new Date().toLocaleDateString('tr-TR');
        if (this.stats.date !== today) {
            this.stats = { date: today, count: 0 };
             this.saveStats();
        }
        return this.stats.count;
    }

    /**
     * Bir numaranın WhatsApp üzerinde var olup olmadığını doğrular.
     */
    async validateOnWhatsApp(sock, phone) {
        try {
            const [result] = await sock.onWhatsApp(phone);
            if (!result || !result.exists) return false;
            return true;
        } catch (err) {
            console.error(`Validation Hatası (${phone}):`, err.message);
            return true; 
        }
    }

    /**
     * Numaranın cooldown (soğuma) süresinde olup olmadığını kontrol eder.
     */
    isInCooldown(phone) {
        const lastSend = this.history[phone];
        if (!lastSend) return false;

        const now = Date.now();
        const diff = now - lastSend;
        const cooldownMs = 24 * 60 * 60 * 1000; // 24 saat

        return diff < cooldownMs;
    }

    /**
     * Gönderim denemesini kaydeder.
     */
    async logSend(phone) {
        this.history[phone] = Date.now();
        this.stats.count++;
        await fs.writeJson(DB_PATH, this.history);
        await this.saveStats();
    }

    /**
     * 48 saatten eski alıcı kayıtlarını temizler (Performans için periyodik temizlik).
     */
    async cleanup() {
        const now = Date.now();
        const cleanupLimit = 48 * 60 * 60 * 1000;
        let cleaned = 0;

        for (const phone in this.history) {
            if (now - this.history[phone] > cleanupLimit) {
                delete this.history[phone];
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 RecipientManager: ${cleaned} eski kayıt temizlendi.`);
            await fs.writeJson(DB_PATH, this.history);
        }
    }
}

module.exports = new RecipientManager();
