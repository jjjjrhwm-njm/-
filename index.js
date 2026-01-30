const express = require('express');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.get('/', (req, res) => res.send('Najm Bot: Requesting Code... ✅'));
app.listen(process.env.PORT || 10000);

async function startNajmBot() {
    // جلسة جديدة تماماً لضمان عدم وجود أخطاء سابقة
    const { state, saveCreds } = await useMultiFileAuthState('session_najm_recurring');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    // --- نظام طلب الكود التكراري كل دقيقتين ---
    let pairingInterval = null;

    if (!sock.authState.creds.registered) {
        let phone = process.env.PHONE_NUMBER;
        if (phone) {
            phone = phone.replace(/[^0-9]/g, '');
            console.log(`\n[نظام النجم] 🔄 سأطلب كوداً جديداً كل دقيقتين للرقم: ${phone}`);
            
            // دالة الطلب
            const requestPairing = async () => {
                try {
                    const code = await sock.requestPairingCode(phone);
                    console.log(`\n************************************`);
                    console.log(`🚀 كود الربط الحالي (صالح لدقيقتين): ${code}`);
                    console.log(`************************************\n`);
                } catch (err) {
                    console.log(`❌ فشل الطلب (قد يكون بسبب ضغط واتساب): ${err.message}`);
                }
            };

            // تنفيذ الطلب الأول فوراً
            setTimeout(requestPairing, 10000);

            // تكرار الطلب كل دقيقتين (120000 ميلي ثانية)
            pairingInterval = setInterval(requestPairing, 120000);
        }
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (pairingInterval) clearInterval(pairingInterval); // توقف عند الفصل
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(() => startNajmBot(), 10000);
        } else if (connection === 'open') {
            console.log('✅ تم الربط بنجاح! سأتوقف عن طلب الأكواد الآن.');
            if (pairingInterval) clearInterval(pairingInterval); // توقف فور النجاح
        }
    });

    // محرك الرد Gemini
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
