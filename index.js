const express = require('express');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Najm Bot is Live! ✅'));
app.listen(port, () => console.log(`Server is running on port ${port}`));

async function startNajmBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_najm');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        // تم حذف printQRInTerminal نهائياً لحل مشكلة السجلات
    });

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // إظهار الـ QR Code يدوياً في السجلات
        if (qr) {
            console.log('--- [ SCAN THIS QR CODE ] ---');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNajmBot();
        } else if (connection === 'open') {
            console.log('✅ Connected Successfully!');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (text) {
            try {
                const result = await model.generateContent(text);
                await sock.sendMessage(msg.key.remoteJid, { text: result.response.text() });
            } catch (e) { console.error('Gemini Error:', e); }
        }
    });
}

startNajmBot();
