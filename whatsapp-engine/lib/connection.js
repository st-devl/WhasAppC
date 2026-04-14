const { 
    makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');

async function getSocketConfig() {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, '../auth/session'));
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Artık terminale basmıyoruz, web'e gönderiyoruz
        auth: state,
        browser: ["Windows", "Chrome", "123.0.0.0"]
    });

    return {
        sock,
        state,
        saveCreds,
        ev: sock.ev
    };
}

module.exports = { getSocketConfig };
