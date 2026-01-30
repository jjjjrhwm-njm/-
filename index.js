const express = require('express');
const qrcode = require('qrcode-terminal'); // تأكد من وجود هذا السطر
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Najm Bot is Online! ✅'));
app.listen(port, () => console.log(`Server listening on port ${port}`));

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pino = require('pino');

async function startNajmBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_najm');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' })
    });

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    sock.ev.on('creds.update', saveCreds);

    // --- هذا هو التعديل المهم لإظهار الـ QR Code يدوياً ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('--- امسح الكود التالي برقم واتسابك ---');
            qrcode.generate(qr, { small: true }); // سيرسم الكود هنا
        }

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
