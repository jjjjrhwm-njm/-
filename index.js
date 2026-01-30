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
        logger: pino({ level: 'silent' }), // صمت تام للسجلات لترى الكود بوضوح
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    let codeSent = false; // لمنع التكرار والفشل

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // طلب كود الربط مرة واحدة فقط وبشكل صحيح
        if (!sock.authState.creds.registered && !codeSent) {
            codeSent = true; 
            let phone = process.env.PHONE_NUMBER;
            if (phone) {
                phone = phone.replace(/[^0-9]/g, '');
                console.log(`\n🟡 جارٍ تحضير كود الربط للرقم: ${phone}...`);
                
                setTimeout(async () => {
                    try {
                        let code = await sock.requestPairingCode(phone);
                        console.log(`\n************************************`);
                        console.log(`🚀 كود الربط الجديد هو: ${code}`);
                        console.log(`************************************\n`);
                    } catch (error) {
                        console.log("❌ فشل مؤقت، سيعيد المحاولة بهدوء...");
                        codeSent = false;
                    }
                }, 15000); // انتظار 15 ثانية لضمان استقرار السيرفر
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNajmBot();
        } else if (connection === 'open') {
            console.log('✅ مبروك! البوت شغال الآن ومتصل.');
        }
    });

    // الجزء الخاص بـ Gemini (الرد الآلي)
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
            } catch (e) { console.error("Error:", e.message); }
        }
    });
}

startNajmBot();
