// --- 1. جزء السيرفر لضمان عمل ريندر (ضروري جداً) ---
const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Najm Bot is Online and Running! ✅');
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

// --- 2. إعدادات الواتساب و Gemini ---
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pino = require('pino');

async function startNajmBot() {
    // حفظ بيانات الجلسة
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_najm');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // سيظهر الـ QR في Logs ريندر
        logger: pino({ level: 'silent' })
    });

    // استخدام مفتاح GOOGLE_API_KEY الذي وضعته في إعدادات Render
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    sock.ev.on('creds.update', saveCreds);

    // استقبال الرسائل
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        console.log(`رسالة جديدة: ${text}`);

        try {
            // إرسال النص لـ Gemini والرد
            const result = await model.generateContent(text);
            const responseText = result.response.text();
            
            await sock.sendMessage(msg.key.remoteJid, { text: responseText });
        } catch (error) {
            console.error("خطأ في Gemini:", error);
        }
    });

    // التعامل مع انقطاع الاتصال
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNajmBot();
        } else if (connection === 'open') {
            console.log('✅ مبروك يا نجم! البوت متصل الآن بالواتساب.');
        }
    });
}

startNajmBot();
