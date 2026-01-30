const express = require('express');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.get('/', (req, res) => res.send('Najm Bot is Fixed! ✅'));
app.listen(process.env.PORT || 10000);

// قفل أمان عالمي يمنع التكرار نهائياً
let pairingCodeRequested = false;

async function startNajmBot() {
    // مجلد جديد لتنظيف الدوامة القديمة
    const { state, saveCreds } = await useMultiFileAuthState('session_najm_v3');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // طلب الكود مرة واحدة فقط في حياة السيرفر
    if (!sock.authState.creds.registered && !pairingCodeRequested) {
        pairingCodeRequested = true;
        let phone = process.env.PHONE_NUMBER;
        if (phone) {
            phone = phone.replace(/[^0-9]/g, '');
            console.log(`\n🟡 نظام الأمان: سأطلب كوداً واحداً فقط للرقم ${phone}.. انتظر 15 ثانية..`);
            
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phone);
                    console.log(`\n************************************`);
                    console.log(`🚀 كود الربط الثابت: ${code}`);
                    console.log(`************************************\n`);
                } catch (err) {
                    console.log("❌ فشل الطلب، انتظر إعادة التشغيل التلقائي الهادئ.");
                    pairingCodeRequested = false; 
                }
            }, 15000); 
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            // إضافة تأخير 5 ثوانٍ عند إعادة التشغيل لمنع الدوامة
            if (shouldReconnect) {
                console.log("🔴 الاتصال مغلق، سأحاول مجدداً بعد 5 ثوانٍ...");
                setTimeout(() => startNajmBot(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ تم الاتصال بنجاح!');
            pairingCodeRequested = false; // تصفير القفل عند النجاح
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
