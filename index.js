const express = require('express');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.get('/', (req, res) => res.send('Najm Bot is Stable ✅'));
app.listen(process.env.PORT || 10000);

// أقفال أمان عالمية تمنع التكرار نهائياً
let isBotStarted = false;
let pairingCodeRequested = false;

async function startNajmBot() {
    if (isBotStarted) return; // يمنع تشغيل أكثر من نسخة من البوت
    isBotStarted = true;

    // مجلد جديد كلياً لتنظيف كل المشاكل السابقة
    const { state, saveCreds } = await useMultiFileAuthState('najm_final_session');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }), // صمت تام للسجلات
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    // 1. طلب كود الربط (يُطلب مـرة واحدة فقط عند التشغيل)
    if (!sock.authState.creds.registered && !pairingCodeRequested) {
        pairingCodeRequested = true;
        let phone = process.env.PHONE_NUMBER;
        if (phone) {
            phone = phone.replace(/[^0-9]/g, '');
            console.log(`\n[نظام النجم] جـارٍ استخراج كود وحيد للرقم ${phone}.. انتظر 20 ثانية..`);
            
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phone);
                    console.log(`\n************************************`);
                    console.log(`🚀 كود الربط الثابت هو: ${code}`);
                    console.log(`************************************\n`);
                } catch (err) {
                    console.log("❌ فشل الطلب، سيتم التصفير لإعادة المحاولة بهدوء.");
                    pairingCodeRequested = false;
                }
            }, 20000); 
        }
    }

    // 2. إدارة الاتصال (بدون رسائل إزعاج)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            isBotStarted = false; // السماح بإعادة التشغيل عند الفصل الحقيقي
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(() => startNajmBot(), 10000);
        } else if (connection === 'open') {
            console.log('✅ مبروك! البوت اتصل الآن بنجاح.');
            pairingCodeRequested = true; // إيقاف أي طلبات أكواد إضافية
        }
    });

    // 3. محرك Gemini (الرد الآلي)
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
