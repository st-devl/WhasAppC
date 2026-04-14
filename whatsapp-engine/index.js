const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { getSocketConfig } = require('./lib/connection');
const { sendBulkWithProgress, stopCampaign } = require('./lib/messenger');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const session = require('express-session');

// --- OTURUM YAPILANDIRMASI ---
app.use(session({
    secret: 'whatsapp-pro-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 saat
}));

// --- KİMLİK BİLGİLERİ ---
const ADMIN_USER = {
    email: 'suheypt@hotmail.com',
    password: 'S-112233*t'
};

// --- AUTH MIDDLEWARE ---
const requireAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        next();
    } else {
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Yetkisiz erişim' });
        }
        res.redirect('/login.html');
    }
};

// Klasörlerin varlığından emin ol
fs.ensureDirSync(path.join(__dirname, 'data'));
fs.ensureDirSync(path.join(__dirname, 'uploads'));

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(express.json());

// --- LOGIN/LOGOUT ENDPOINTLERİ ---
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_USER.email && password === ADMIN_USER.password) {
        req.session.user = { email };
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
    res.json({ authenticated: !!(req.session && req.session.user) });
});

// Login sayfası hariç tüm statik dosyaları koru
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.use(requireAuth, express.static('public'));
app.use('/uploads', requireAuth, express.static('uploads'));

let sock = null;
let isConnected = false;
let currentMedia = [];
let lastQR = null;

// --- API ENDPOINTLERİ ---

app.get('/api/version', async (req, res) => {
    try {
        const pkg = await fs.readJson(path.join(__dirname, 'package.json'));
        res.json({ version: pkg.version });
    } catch (e) {
        res.json({ version: '1.2.0' });
    }
});

app.get('/api/templates', async (req, res) => {
    const p = path.join(__dirname, 'data/templates.json');
    const data = await fs.readJson(p).catch(() => []);
    res.json(data);
});

app.post('/api/templates', async (req, res) => {
    const p = path.join(__dirname, 'data/templates.json');
    const templates = await fs.readJson(p).catch(() => []);
    templates.push({ id: Date.now(), ...req.body });
    await fs.writeJson(p, templates);
    res.json({ success: true });
});

// --- GRUP YÖNETİMİ API ENDPOINTLERİ ---
const groupsPath = path.join(__dirname, 'data/groups.json');

app.get('/api/groups', async (req, res) => {
    const data = await fs.readJson(groupsPath).catch(() => []);
    res.json(data);
});

app.post('/api/groups', async (req, res) => {
    const groups = await fs.readJson(groupsPath).catch(() => []);
    const newGroup = { id: Date.now().toString(), name: req.body.name, contacts: [] };
    groups.push(newGroup);
    await fs.writeJson(groupsPath, groups);
    res.json(newGroup);
});

app.put('/api/groups/:id', async (req, res) => {
    const groups = await fs.readJson(groupsPath).catch(() => []);
    const idx = groups.findIndex(g => g.id === req.params.id);
    if (idx !== -1) {
        groups[idx].contacts = req.body.contacts || [];
        await fs.writeJson(groupsPath, groups);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Grup bulunamadı' });
    }
});

app.delete('/api/groups/:id', async (req, res) => {
    const groups = await fs.readJson(groupsPath).catch(() => []);
    const filtered = groups.filter(g => g.id !== req.params.id);
    await fs.writeJson(groupsPath, filtered);
    res.json({ success: true });
});

app.post('/api/upload-media', upload.array('media'), (req, res) => {
    currentMedia = req.files.map(f => ({ path: f.path, mimetype: f.mimetype, name: f.originalname }));
    res.json(currentMedia);
});

app.post('/api/upload-excel', upload.single('excel'), (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = xlsx.utils.sheet_to_json(sheet);
        
        const data = rawData.map(row => ({
            phone: String(row['Numara'] || row['phone'] || ''),
            name: String(row['İsim'] || row['name'] || ''),
            surname: String(row['Soyisim'] || '')
        })).filter(row => row.phone);

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Excel okuma hatası' });
    }
});

app.get('/api/download-sample', (req, res) => {
    const wb = xlsx.utils.book_new();
    const ws_data = [
        ["Numara", "İsim", "Soyisim"], 
        ["905320000000", "Ahmet", "Yılmaz"], 
        ["905330000000", "Ayşe", "Demir"]
    ];
    const ws = xlsx.utils.aoa_to_sheet(ws_data);
    xlsx.utils.book_append_sheet(wb, ws, "Rehber");
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ornek_rehber.xlsx');
    res.send(buf);
});

app.post('/api/reset-session', async (req, res) => {
    try {
        console.log('🔄 Oturum sıfırlama isteği alındı...');
        isConnected = false;
        lastQR = null;
        if (sock) { sock.end(); }
        const sessionPath = path.join(__dirname, 'auth/session');
        if (fs.existsSync(sessionPath)) fs.removeSync(sessionPath);
        res.json({ success: true, message: 'Oturum temizlendi, taze QR kod hazırlanıyor...' });
        setTimeout(() => initWhatsApp(), 1000);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    console.log('🔌 Tarayıcı bağlandı.');
    socket.emit('status', isConnected ? 'connected' : 'disconnected');
    if (!isConnected && lastQR) socket.emit('qr', lastQR);
    
    socket.on('stop-bulk', () => {
        stopCampaign(socket.id);
        socket.emit('log', { type: 'error', message: '🛑 İşlem durduruldu.' });
    });

    socket.on('start-bulk', async (data) => {
        const { contacts, message, delayRange, dailyLimit } = data;
        if (!isConnected || !sock) return socket.emit('log', { type: 'error', message: 'Bağlı değil!' });
        socket.emit('log', { type: 'info', message: '🚀 Gönderim kuyruğu başladı.' });
        try {
            await sendBulkWithProgress(sock, contacts, message, socket, delayRange, currentMedia, socket.id, { dailyLimit });
            socket.emit('log', { type: 'success', message: '✨ Tamamlandı.' });
            currentMedia = [];
        } catch (err) {
            socket.emit('log', { type: 'error', message: 'Hata: ' + err.message });
        }
    });
});

async function initWhatsApp() {
    console.log('🚀 WhatsApp motoru başlatılıyor...');
    try {
        const config = await getSocketConfig();
        sock = config.sock;
        config.ev.on('creds.update', config.saveCreds);
        config.ev.on('connection.update', (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            if (qr) {
                console.log('📷 Yeni QR Kod üretildi.');
                lastQR = qr;
                io.emit('qr', qr);
            }
            
            if (connection === 'open') { 
                console.log('✅ Bağlantı BAŞARILI!');
                // İnsan gibi davran: Bağlantı açıldıktan sonra 5-15 saniye "yüklenme" bekle
                const initialWait = Math.floor(Math.random() * 10000) + 5000;
                setTimeout(() => {
                    isConnected = true; 
                    lastQR = null;
                    io.emit('status', 'connected'); 
                }, initialWait);
            }
            
            if (connection === 'close') { 
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log('❌ Bağlantı Kesildi. Kod:', reason);
                isConnected = false; 
                io.emit('status', 'disconnected');
                
                // Oturum geçersizse temizle
                if (reason === 401 || reason === 440) {
                    console.log('⚠️ Oturum bozulmuş. Otomatik temizleniyor...');
                    const sessionPath = path.join(__dirname, 'auth/session');
                    if (fs.existsSync(sessionPath)) fs.removeSync(sessionPath);
                    // Rastgele 10-30 saniye sonra yeniden başla
                    const reconnectDir = Math.floor(Math.random() * 20000) + 10000;
                    setTimeout(() => initWhatsApp(), reconnectDir);
                } else {
                    // Normal kopmalarda rastgele 30sn - 2dk arası bekle (Sistem sahtecilik yakalamasın)
                    const reconnectNormal = Math.floor(Math.random() * 90000) + 30000;
                    console.log(`⏳ ${reconnectNormal/1000}sn sonra yeniden bağlanılacak...`);
                    setTimeout(() => initWhatsApp(), reconnectNormal);
                }
            }
        });
    } catch (err) {
        console.log('🚨 Başlatma hatası:', err.message);
        const retryDelay = Math.floor(Math.random() * 30000) + 30000;
        setTimeout(() => initWhatsApp(), retryDelay);
    }
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('⚠️ [CRITICAL] Uncaught Exception:', err);
});

const PORT = 3005;
server.listen(PORT, () => {
    console.log(`\n================================================`);
    console.log(`🌍 WhasAppC Pro Aktif: http://localhost:${PORT}`);
    console.log(`================================================\n`);
    initWhatsApp();
});
