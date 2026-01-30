const express = require('express');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.get('/', (req, res) => res.send('Najm Bot is Online! ✅'));
app.listen(process.env.PORT || 10000);

// متغير عالمي لمنع التكرار نهائياً
let isCodeAlreadyRequested = false;

async function startNajmBot() {
    // غيرنا الاسم هنا لبدء جلسة جديدة ونظيفة
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_final');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔴 الاتصال انقطع، جارٍ إعادة المحاولة...');
            if (shouldReconnect) startNajmBot();
        } else if (connection === 'open') {
            console.log('✅ مبروك يا نجم! البوت اتصل بنجاح.');
        }

        // طلب كود الربط - بطريقة ذكية تمنع التكرار
        if (!sock.authState.creds.registered && !isCodeAlreadyRequested) {
            isCodeAlreadyRequested = true;
            let phone = process.env.PHONE_NUMBER;
            if (phone) {
                phone = phone.replace(/[^0-9]/g, '');
                console.log(`\n🟡 انتظر 20 ثانية... جارٍ استخراج كود واحد ونظيف للرقم: ${phone}`);
                
                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(phone);
                        console.log(`\n************************************`);
                        console.log(`🚀 كود الربط الجديد الخاص بك: ${code}`);
                        console.log(`************************************\n`);
                    } catch (error) {
                        console.log("❌ فشل الطلب، سيتم التصفير للمحاولة القادمة.");
                        isCodeAlreadyRequested = false;
                    }
                }, 20000); // زيادة وقت الانتظار لضمان استقرار السيرفر
            }
        }
    });

    // جزء الرد عبر Gemini
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
