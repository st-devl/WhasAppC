const recipientManager = require('./recipient_manager');
const { generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

const delay = ms => new Promise(res => setTimeout(res, ms));

// Campaign state in memory
let activeCampaigns = new Map();

function personalizeMessage(text, name) {
    let processed = text.replace(/{{ad}}/g, name);
    processed = processed.trim().replace(/\s+/g, ' ');
    return processed;
}

function getHumanDelay(min, max) {
    const r = Math.random();
    if (r < 0.8) {
        return Math.floor(Math.random() * (max - min) * 0.4 + min) * 1000;
    } else {
        return Math.floor(Math.random() * (max - min) + min) * 1000;
    }
}

function isNightMode() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 22 || hour < 9;
}

async function sendBulkWithProgress(sock, contacts, message, socket, delayRange, mediaFiles = [], campaignId, userSettings = {}) {
    const [min, max] = delayRange || [20, 90];
    const dailyLimit = userSettings.dailyLimit || 50;
    let failCount = 0; 
    
    activeCampaigns.set(campaignId, {
        id: campaignId,
        status: 'running',
        total: contacts.length,
        processed: 0,
        logs: [],
        progress: 0
    });

    const addLog = (type, message, progress) => {
        const campaign = activeCampaigns.get(campaignId);
        if(campaign) {
            campaign.logs.push({ type, message, timestamp: Date.now() });
            if(progress !== undefined) campaign.progress = progress;
            activeCampaigns.set(campaignId, campaign);
        }
        if(socket) socket.emit('log', { type, message, progress });
    };

    // 🔴 1. WhatsApp'a Medyayı TEK SEFER Yükleme İşlemi (Relay Mimarisi) 🔴
    let preUploadedMedia = [];
    if (mediaFiles && mediaFiles.length > 0) {
        addLog('info', `[!] Medya dosyaları WhatsApp'a şifrelenip sadece 1 kereliğine yükleniyor...`);
        for (let file of mediaFiles) {
            try {
                const options = {};
                if (file.mimetype.startsWith('image/')) options.image = { url: file.path };
                else if (file.mimetype.startsWith('video/')) options.video = { url: file.path };
                else continue;
                
                // generateWAMessageContent sadece 1 kere sunucuya yükleyip MediaKey döndürür
                const mediaContent = await generateWAMessageContent(options, { upload: sock.waUploadToServer });
                preUploadedMedia.push({ type: options.image ? 'image' : 'video', content: mediaContent });
                
                addLog('success', `[✅] Yükleme Tamamlandı: ${file.name}`);
            } catch(e) {
                addLog('error', `❌ Medya Yükleme Hatası (${file.name}): ${e.message}`);
            }
        }
        addLog('info', `🚀 Medyalar hazır. Tekli aktarım ile asıl gönderim başlıyor...`);
    }

    for (let i = 0; i < contacts.length; i++) {
        const sentToday = recipientManager.getDailyCount();
        const campaignState = activeCampaigns.get(campaignId);
        if (!campaignState || campaignState.status === 'stopped') {
            addLog('error', '🛑 Gönderim durduruldu.');
            break;
        }

        if (isNightMode()) {
            addLog('wait', '🌙 Gece yasağı devrede (22:00-09:00). Gönderim duraklatıldı. Sabah devam edilecek.');
            while (isNightMode() && activeCampaigns.get(campaignId)?.status !== 'stopped') {
                await delay(60000); 
            }
            if (activeCampaigns.get(campaignId)?.status === 'stopped') break;
        }

        if (sentToday >= dailyLimit) {
            addLog('error', `🚫 Günlük limite ulaşıldı (${dailyLimit}). Güvenlik gereği bugünlük durduruldu.`);
            break;
        }

        if (failCount >= 5) {
            addLog('error', '🛑 Çok fazla ardışık hata! Ban riskine karşı kampanya güvenlik nedeniyle durduruldu.');
            break;
        }

        if (i > 0) {
            if (i % 40 === 0) {
                const longBreak = Math.floor(Math.random() * (45 - 20 + 1) + 20);
                addLog('wait', `☕ Uzun mola zamanı (40 mesajda bir). ${longBreak} dakika bekleniyor...`);
                await delay(longBreak * 60000);
            } else if (i % 12 === 0) {
                const shortBreak = Math.floor(Math.random() * (8 - 3 + 1) + 3);
                addLog('wait', `🥤 Kısa mola (12 mesajda bir). ${shortBreak} dakika bekleniyor...`);
                await delay(shortBreak * 60000);
            }
        }

        const contact = contacts[i];
        let phone = String(contact.phone).replace(/[^0-9]/g, '');
        
        if (phone.length === 10 && phone.startsWith('5')) phone = '90' + phone;
        if (phone.length === 11 && phone.startsWith('05')) phone = '90' + phone.substring(1);
        if (!phone.includes('@s.whatsapp.net')) phone = `${phone}@s.whatsapp.net`;

        if (recipientManager.isInCooldown(phone)) {
            addLog('wait', `⏭️ Atlandı (Cooldown): ${phone} için son 24 saat içinde gönderim yapılmış.`);
            continue;
        }

        const nameLabel = contact.name && contact.name !== 'Bilinmeyen' ? contact.name : 'Müşterimiz';
        const currentProgress = ((i + 1) / contacts.length) * 100;
        
        addLog('process', `[${i + 1}/${contacts.length}] İşleniyor: ${nameLabel}`, currentProgress);
        
        if(campaignState) {
             campaignState.processed = i + 1;
        }

        const exists = await recipientManager.validateOnWhatsApp(sock, phone);
        if (!exists) {
            addLog('error', `❌ Atlandı: ${phone} numaralı kullanıcı WhatsApp kullanmıyor.`);
            continue;
        }

        const finalMsg = personalizeMessage(message, nameLabel);

        try {
            await sock.sendPresenceUpdate('composing', phone);
            await delay(Math.floor(Math.random() * 4000) + 2000);
            await sock.sendPresenceUpdate('paused', phone);

            // Yeni RELAY MESSAGE Mimarisi
            if (preUploadedMedia.length > 0) {
                for (let j = 0; j < preUploadedMedia.length; j++) {
                    const mediaUpload = preUploadedMedia[j];
                    
                    // Medya içerik yapısını Deep Copy yapıp Caption atayacağız (Sadece metin değişecek)
                    const clonedContent = JSON.parse(JSON.stringify(mediaUpload.content));
                    
                    if (j === 0) { 
                        if (mediaUpload.type === 'image') clonedContent.imageMessage.caption = finalMsg;
                        else if (mediaUpload.type === 'video') clonedContent.videoMessage.caption = finalMsg;
                    }

                    // Taze kopya mesaj oluşturuluyor (WhatsApp sunucusuna medyanın kodu tekrar inlenmeden fırlatılır)
                    const msg = generateWAMessageFromContent(phone, clonedContent, { userJid: sock.user.id });
                    
                    // Doğrudan yolla (Relay)
                    await sock.relayMessage(phone, msg.message, { messageId: msg.key.id });
                    
                    await delay(getHumanDelay(2, 5)); 
                }
            } else {
                await sock.sendMessage(phone, { text: finalMsg });
            }

            await recipientManager.logSend(phone);
            addLog('success', `✅ İletildi: ${nameLabel} (${recipientManager.getDailyCount()}/${dailyLimit})`);

        } catch (err) {
            failCount++;
            addLog('error', `❌ Hata: ${err.message}`);
        }

        if (i < contacts.length - 1 && activeCampaigns.get(campaignId)?.status !== 'stopped') {
            const waitTime = getHumanDelay(min, max);
            addLog('wait', `⏳ ${waitTime/1000}sn bekleniyor...`);
            await delay(waitTime);
        }
    }
    
    // İşlem tamamen bitince
    const finalState = activeCampaigns.get(campaignId);
    if(finalState && finalState.status !== 'stopped') {
        finalState.status = 'completed';
        addLog('success', '✨ Kampanya Tamamlandı.');
    }
}

function stopCampaign(campaignId) {
    const campaign = activeCampaigns.get(campaignId);
    if(campaign) {
        campaign.status = 'stopped';
        activeCampaigns.set(campaignId, campaign);
    }
}

function getCampaignStatus(campaignId) {
    return activeCampaigns.get(campaignId) || null;
}

module.exports = { sendBulkWithProgress, stopCampaign, getCampaignStatus };
