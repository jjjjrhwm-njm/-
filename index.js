const express = require('express');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.get('/', (req, res) => res.send('Najm Bot is Online! ✅'));
app.listen(process.env.PORT || 10000);

async function startNajmBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_najm');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"] // ضروري لعمل كود الربط
    });

    // --- ميزة الربط بالرقم (Pairing Code) ---
    // إذا لم تكن مسجلاً دخولك، سيطلب البوت كوداً لرقمك
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.PHONE_NUMBER; // سنضيف رقمك في Render
        if (phoneNumber) {
            setTimeout(async () => {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n\n🚀 كود الربط الخاص بك هو: ${code}\n\n`);
            }, 3000);
        }
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNajmBot();
        } else if (connection === 'open') {
            console.log('✅ تم الاتصال بنجاح!');
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
            } catch (e) { console.error(e); }
        }
    });
}
startNajmBot();
