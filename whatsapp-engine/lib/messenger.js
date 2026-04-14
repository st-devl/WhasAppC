const recipientManager = require('./recipient_manager');

const delay = ms => new Promise(res => setTimeout(res, ms));

let activeProcesses = new Set(); // Aktif gönderimlerin takibi

/**
 * Mesajı kişiselleştirir ve normalize eder.
 * @param {string} text Ham mesaj metni
 * @param {string} name Kişi adı
 */
function personalizeMessage(text, name) {
    // 1. Basit Kişiselleştirme
    let processed = text.replace(/{{ad}}/g, name);

    // 2. Mesaj Normalizasyonu (Trim ve çift boşluk temizliği)
    processed = processed.trim().replace(/\s+/g, ' ');

    return processed;
}

/**
 * İnsan davranışına yakın gecikme üretir (Pareto Dağılımı taklidi).
 * Çoğunlukla kısa, bazen uzun beklemeler.
 */
function getHumanDelay(min, max) {
    const r = Math.random();
    // %80 ihtimalle alt yarıda, %20 ihtimalle üst yarıda veya ekstrem değerde bekle
    if (r < 0.8) {
        return Math.floor(Math.random() * (max - min) * 0.4 + min) * 1000;
    } else {
        return Math.floor(Math.random() * (max - min) + min) * 1000;
    }
}

/**
 * Gece yasağı kontrolü (22:00 - 09:00)
 */
function isNightMode() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 22 || hour < 9;
}

async function sendBulkWithProgress(sock, contacts, message, socket, delayRange, mediaFiles = [], campaignId, userSettings = {}) {
    const [min, max] = delayRange || [20, 90];
    const dailyLimit = userSettings.dailyLimit || 50;
    let failCount = 0; // Art arda başarısızlık takibi
    
    activeProcesses.add(campaignId);

    for (let i = 0; i < contacts.length; i++) {
        // --- GÜNCEL GÜNLÜK SAYACI AL ---
        const sentToday = recipientManager.getDailyCount();
        if (!activeProcesses.has(campaignId)) {
            socket.emit('log', { type: 'error', message: '🛑 Gönderim durduruldu.' });
            break;
        }

        // --- KRİTİK KONTROLLER (ENGINE INTEGRITY) ---

        // 1. Gece Yasağı
        if (isNightMode()) {
            socket.emit('log', { type: 'wait', message: '🌙 Gece yasağı devrede (22:00-09:00). Gönderim duraklatıldı. Sabah devam edilecek.' });
            while (isNightMode() && activeProcesses.has(campaignId)) {
                await delay(60000); 
            }
            if (!activeProcesses.has(campaignId)) break;
        }

        // 2. Günlük Limit
        if (sentToday >= dailyLimit) {
            socket.emit('log', { type: 'error', message: `🚫 Günlük limite ulaşıldı (${dailyLimit}). Güvenlik gereği bugünlük durduruldu.` });
            break;
        }

        // 3. Başarısızlık Oranı (Fail Rate) Koruması
        if (failCount >= 5) {
            socket.emit('log', { type: 'error', message: '🛑 Çok fazla ardışık hata! Ban riskine karşı kampanya güvenlik nedeniyle durduruldu.' });
            break;
        }

        // 4. Molalar
        if (i > 0) {
            if (i % 40 === 0) {
                const longBreak = Math.floor(Math.random() * (45 - 20 + 1) + 20);
                socket.emit('log', { type: 'wait', message: `☕ Uzun mola zamanı (40 mesajda bir). ${longBreak} dakika bekleniyor...` });
                await delay(longBreak * 60000);
            } else if (i % 12 === 0) {
                const shortBreak = Math.floor(Math.random() * (8 - 3 + 1) + 3);
                socket.emit('log', { type: 'wait', message: `🥤 Kısa mola (12 mesajda bir). ${shortBreak} dakika bekleniyor...` });
                await delay(shortBreak * 60000);
            }
        }

        const contact = contacts[i];
        let phone = String(contact.phone).replace(/[^0-9]/g, '');
        
        if (phone.length === 10 && phone.startsWith('5')) phone = '90' + phone;
        if (phone.length === 11 && phone.startsWith('05')) phone = '90' + phone.substring(1);
        if (!phone.includes('@s.whatsapp.net')) phone = `${phone}@s.whatsapp.net`;

        // 5. Cooldown Kontrolü
        if (recipientManager.isInCooldown(phone)) {
            socket.emit('log', { type: 'wait', message: `⏭️ Atlandı (Cooldown): ${phone} için son 24 saat içinde gönderim yapılmış.` });
            continue;
        }

        const nameLabel = contact.name && contact.name !== 'Bilinmeyen' ? contact.name : 'Müşterimiz';
        
        socket.emit('log', { 
            type: 'process', 
            message: `[${i + 1}/${contacts.length}] İşleniyor: ${nameLabel}`,
            progress: ((i + 1) / contacts.length) * 100
        });

        // 6. Alıcı Doğrulama (On-WhatsApp)
        const exists = await recipientManager.validateOnWhatsApp(sock, phone);
        if (!exists) {
            socket.emit('log', { type: 'error', message: `❌ Atlandı: ${phone} numaralı kullanıcı WhatsApp kullanmıyor.` });
            continue;
        }

        const finalMsg = personalizeMessage(message, nameLabel);

        try {
            // "Yazıyor..." simülasyonu (Isınma Kalkanı)
            await sock.sendPresenceUpdate('composing', phone);
            await delay(Math.floor(Math.random() * 4000) + 2000);
            await sock.sendPresenceUpdate('paused', phone);

            if (mediaFiles.length > 0) {
                for (let j = 0; j < mediaFiles.length; j++) {
                    const file = mediaFiles[j];
                    const options = {};
                    if (file.mimetype.startsWith('image/')) options.image = { url: file.path };
                    else if (file.mimetype.startsWith('video/')) options.video = { url: file.path };
                    
                    if (j === 0) options.caption = finalMsg; 

                    await sock.sendMessage(phone, options);
                    await delay(getHumanDelay(2, 5)); 
                }
            } else {
                await sock.sendMessage(phone, { text: finalMsg });
            }

            await recipientManager.logSend(phone);
            socket.emit('log', { type: 'success', message: `✅ İletildi: ${nameLabel} (${recipientManager.getDailyCount()}/${dailyLimit})` });

        } catch (err) {
            failCount++;
            socket.emit('log', { type: 'error', message: `❌ Hata: ${err.message}` });
        }

        if (i < contacts.length - 1 && activeProcesses.has(campaignId)) {
            const waitTime = getHumanDelay(min, max);
            socket.emit('log', { type: 'wait', message: `⏳ ${waitTime/1000}sn bekleniyor...` });
            await delay(waitTime);
        }
    }
    activeProcesses.delete(campaignId);
}

function stopCampaign(campaignId) {
    activeProcesses.delete(campaignId);
}

module.exports = { sendBulkWithProgress, stopCampaign };
