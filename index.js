const express = require('express');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.get('/', (req, res) => res.send('Najm Bot: One-Time Request Mode ✅'));
app.listen(process.env.PORT || 10000);

// قفل أمان عالمي - لا يتأثر بإعادة تشغيل الدالة
let hasAttemptedPairing = false;

async function startNajmBot() {
    // استخدمنا مجلد جديد لضمان جلسة نظيفة تماماً
    const { state, saveCreds } = await useMultiFileAuthState('session_one_shot_najm');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Najm-Bot-Control", "Chrome", "1.0.0"] 
    });

    sock.ev.on('creds.update', saveCreds);

    // --- نظام الطلب لمرة واحدة فقط ---
    if (!sock.authState.creds.registered && !hasAttemptedPairing) {
        hasAttemptedPairing = true; // تفعيل القفل فوراً
        let phone = process.env.PHONE_NUMBER;
        
        if (phone) {
            phone = phone.replace(/[^0-9]/g, '');
            console.log(`\n[نظام النجم] 🛡️ جـارٍ طلب كود لمرة واحدة فقط للرقم: ${phone}`);
            console.log(`[نظام النجم] ⏳ انتظر 15 ثانية لهدوء السيرفر...`);
            
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phone);
                    console.log(`\n************************************`);
                    console.log(`🚀 كود الربط الخاص بك: ${code}`);
                    console.log(`************************************`);
                    console.log(`⚠️ لن يتم طلب أي كود آخر تلقائياً لسلامة رقمك.\n`);
                } catch (err) {
                    console.log(`❌ فشل طلب الكود: ${err.message}`);
                    console.log(`💡 نصيحة: إذا ظهر خطأ 429، انتظر 30 دقيقة قبل إعادة التشغيل اليدوي.`);
                }
            }, 15000);
        }
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            // يعيد تشغيل الاتصال لكنه لن يطلب كوداً جديداً بسبب القفل العالمي
            if (shouldReconnect) setTimeout(() => startNajmBot(), 10000);
        } else if (connection === 'open') {
            console.log('✅ تم الربط بنجاح! البوت شغال الآن.');
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
