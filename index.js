const express = require('express');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.get('/', (req, res) => res.send('Najm Bot is Stable! ✅'));
app.listen(process.env.PORT || 10000);

async function startNajmBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_najm');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- طلب كود الربط بأمان وبدون انهيار ---
    if (!sock.authState.creds.registered) {
        let phone = process.env.PHONE_NUMBER;
        if (phone) {
            // تنظيف الرقم من أي مسافات أو أصفار زائدة في البداية
            phone = phone.replace(/[^0-9]/g, ''); 
            
            console.log(`جارٍ طلب كود الربط للرقم: ${phone}...`);
            
            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(phone);
                    console.log(`\n\n************************************`);
                    console.log(`🚀 كود الربط الخاص بك هو: ${code}`);
                    console.log(`************************************\n\n`);
                } catch (error) {
                    console.error("فشل طلب الكود، سأحاول مرة أخرى عند إعادة التشغيل:", error.message);
                }
            }, 10000); // انتظر 10 ثوانٍ لضمان استقرار الاتصال
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
            console.log('✅ متصل الآن! جرب إرسال رسالة لواتسابك.');
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
            } catch (e) { console.error("Gemini Error:", e.message); }
        }
    });
}

startNajmBot();
