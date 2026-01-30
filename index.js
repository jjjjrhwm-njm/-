const express = require('express');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.get('/', (req, res) => res.send('Najm Bot is Stable ✅'));
app.listen(process.env.PORT || 10000);

async function startNajmBot() {
    // استخدمنا مجلد جديد تماماً لضمان تنظيف البيانات القديمة
    const { state, saveCreds } = await useMultiFileAuthState('session_najm_final');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // 1. طلب كود الربط (خارج الـ connection.update لتجنب التكرار)
    if (!sock.authState.creds.registered) {
        let phone = process.env.PHONE_NUMBER;
        if (phone) {
            phone = phone.replace(/[^0-9]/g, '');
            console.log(`\n🟡 هدوء تام... سأطلب كوداً واحداً فقط للرقم ${phone} بعد 10 ثوانٍ...`);
            
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phone);
                    console.log(`\n************************************`);
                    console.log(`🚀 كود الربط الخاص بك هو: ${code}`);
                    console.log(`************************************\n`);
                } catch (err) {
                    console.log("❌ فشل الطلب، أعد تشغيل السيرفر يدوياً.");
                }
            }, 10000); 
        }
    }

    sock.ev.on('creds.update', saveCreds);

    // 2. إدارة الاتصال (فقط لإعادة التشغيل عند الفصل)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNajmBot();
        } else if (connection === 'open') {
            console.log('✅ تم الربط! البوت جاهز للعمل.');
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
