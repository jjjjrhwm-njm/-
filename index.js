const express = require('express');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.get('/', (req, res) => res.send('Najm Bot: Ready for Pairing ✅'));
app.listen(process.env.PORT || 10000);

async function startNajmBot() {
    // 1. مجلد جلسة جديد كلياً لم يستخدم من قبل
    const { state, saveCreds } = await useMultiFileAuthState('session_ultra_clean_v9');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        // 2. تغيير البصمة لمتصفح سفاري على ماك لتجاوز حظر كروم
        browser: ["Mac OS", "Safari", "10.15.7"] 
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        let phone = process.env.PHONE_NUMBER;
        if (phone) {
            phone = phone.replace(/[^0-9]/g, '');
            console.log(`\n[نظام النجم] 🚨 محاولة استخراج كود "نقي" للرقم: ${phone}`);
            
            // انتظر 10 ثوانٍ لفتح القناة ثم اطلب الكود
            await delay(10000); 
            
            try {
                const code = await sock.requestPairingCode(phone);
                console.log(`\n************************************`);
                console.log(`🚀 مبروك! كود الربط هو: ${code}`);
                console.log(`************************************\n`);
            } catch (err) {
                console.log(`❌ فشل الطلب: ${err.message}`);
                console.log(`💡 جرب تغيير "Region" السيرفر في Render إذا استمر الفشل.`);
            }
        }
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(() => startNajmBot(), 15000);
        } else if (connection === 'open') {
            console.log('✅ تم الربط بنجاح!');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (text) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const result = await model.generateContent(text);
                await sock.sendMessage(msg.key.remoteJid, { text: result.response.text() });
            } catch (e) { console.error("Gemini Error:", e.message); }
        }
    });
}

startNajmBot();
