const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

// Ensure data dir exists
fs.ensureDirSync(path.join(__dirname, '../data'));

const dbFile = path.join(__dirname, '../data/database.sqlite');
const db = new sqlite3.Database(dbFile);

// Initialization & Migration
db.serialize(() => {
    // Groups Table
    db.run(`CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Contacts Table (linked to a group)
    db.run(`CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT,
        name TEXT,
        surname TEXT,
        phone TEXT,
        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    )`);

    // Templates Table
    db.run(`CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT,
        text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Optional: Migrate existing JSONs
    migrateJSONs();
});

async function migrateJSONs() {
    // 1. Templates
    const tplPath = path.join(__dirname, '../data/templates.json');
    if (fs.existsSync(tplPath)) {
        try {
            const templates = await fs.readJson(tplPath);
            templates.forEach(t => {
                 db.run(`INSERT OR IGNORE INTO templates (id, name, text) VALUES (?, ?, ?)`, [t.id.toString(), t.name, t.text]);
            });
            fs.renameSync(tplPath, tplPath + '.migrated');
            console.log("✅ Templates veritabanına taşındı.");
        } catch(e) { console.error("Template migration error", e); }
    }

    // 2. Groups & Contacts
    const grpPath = path.join(__dirname, '../data/groups.json');
    if (fs.existsSync(grpPath)) {
        try {
            const groups = await fs.readJson(grpPath);
            groups.forEach(g => {
                 db.run(`INSERT OR IGNORE INTO groups (id, name) VALUES (?, ?)`, [g.id, g.name], (err) => {
                     if (!err && g.contacts && g.contacts.length > 0) {
                         const stmt = db.prepare(`INSERT INTO contacts (group_id, name, surname, phone) VALUES (?, ?, ?, ?)`);
                         g.contacts.forEach(c => {
                             stmt.run([g.id, c.name || '', c.surname || '', c.phone]);
                         });
                         stmt.finalize();
                     }
                 });
            });
            setTimeout(() => { fs.renameSync(grpPath, grpPath + '.migrated'); }, 1000);
            console.log("✅ Groups veritabanına taşındı.");
        } catch(e) { console.error("Group migration error", e); }
    }
}

const getGroups = () => new Promise((resolve, reject) => {
    db.all(`SELECT * FROM groups`, [], (err, groups) => {
        if(err) return reject(err);
        db.all(`SELECT * FROM contacts`, [], (err, contacts) => {
             if(err) return reject(err);
             groups.forEach(g => {
                 g.contacts = contacts.filter(c => c.group_id === g.id).map(c => ({
                     name: c.name, surname: c.surname, phone: c.phone
                 }));
             });
             resolve(groups);
        });
    });
});

const createGroup = (id, name) => new Promise((resolve, reject) => {
    db.run(`INSERT INTO groups (id, name) VALUES (?, ?)`, [id, name], function(err) {
        if(err) return reject(err);
        resolve({ id, name, contacts: [] });
    });
});

const updateGroupContacts = (groupId, contactsList) => new Promise((resolve, reject) => {
    db.run(`DELETE FROM contacts WHERE group_id = ?`, [groupId], (err) => {
        if(err) return reject(err);
        if (contactsList.length === 0) return resolve();
        
        const placeholders = contactsList.map(() => '(?, ?, ?, ?)').join(',');
        const params = [];
        contactsList.forEach(c => {
            params.push(groupId, c.name || '', c.surname || '', c.phone);
        });
        
        db.run(`INSERT INTO contacts (group_id, name, surname, phone) VALUES ${placeholders}`, params, (err) => {
            if(err) return reject(err);
            resolve();
        });
    });
});

const deleteGroup = (id) => new Promise((resolve, reject) => {
    db.run(`DELETE FROM contacts WHERE group_id = ?`, [id], (err) => {
        db.run(`DELETE FROM groups WHERE id = ?`, [id], (err) => {
            if(err) return reject(err);
            resolve();
        });
    });
});

const getTemplates = () => new Promise((resolve, reject) => {
    db.all(`SELECT * FROM templates`, [], (err, rows) => {
        if(err) return reject(err);
        resolve(rows);
    });
});

const createTemplate = (id, name, text) => new Promise((resolve, reject) => {
    db.run(`INSERT INTO templates (id, name, text) VALUES (?, ?, ?)`, [id, name, text], (err) => {
        if(err) return reject(err);
        resolve({ id, name, text });
    });
});

module.exports = { getGroups, createGroup, updateGroupContacts, deleteGroup, getTemplates, createTemplate };
