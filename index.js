const express = require('express');
const pino = require('pino');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    delay, 
    makeCacheableSignalKeyStore 
} = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.get('/', (req, res) => res.send('Najm Bot: Active ✅'));
app.listen(process.env.PORT || 10000);

async function startNajmBot() {
    // إعدادات الحالة والجلسة
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        logger: pino({ level: 'silent' }),
        // تعريف المتصفح ضروري لظهور كود الربط بشكل صحيح
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        printQRInTerminal: false // سنستخدم الكود بدلاً من QR
    });

    // --- منطق طلب كود الربط (Pairing Code) ---
    if (!sock.authState.creds.registered) {
        let phoneNumber = process.env.PHONE_NUMBER; 
        // تأكد أن الرقم بصيغة دولية بدون + (مثلاً: 9665xxxxxxxx)
        if (phoneNumber) {
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            
            console.log(`\n[نظام النجم] 🛡️ جاري تجهيز كود الربط للرقم: ${phoneNumber}`);
            
            // انتظار قصير للتأكد من جاهزية الاتصال
            await delay(5000); 
            
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n====================================`);
                console.log(`🚀 كود الربط الخاص بك هو: ${code}`);
                console.log(`====================================\n`);
            } catch (error) {
                console.error('❌ فشل في جلب كود الربط:', error);
            }
        } else {
            console.log("❌ خطأ: لم يتم العثور على PHONE_NUMBER في المتغيرات البيئية.");
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔄 انقطع الاتصال، جاري إعادة المحاولة...', shouldReconnect);
            if (shouldReconnect) startNajmBot();
        } else if (connection === 'open') {
            console.log('✅ تم الاتصال بنجاح! البوت جاهز للعمل.');
        }
    });

    // --- محرك Gemini ---
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (text) {
            try {
                // إظهار حالة "جاري الكتابة"
                await sock.sendPresenceUpdate('composing', remoteJid);
                
                const result = await model.generateContent(text);
                const response = await result.response;
                
                await sock.sendMessage(remoteJid, { text: response.text() });
            } catch (e) {
                console.error("Gemini Error:", e.message);
                // لا نرسل رسالة خطأ للمستخدم لتجنب الإزعاج
            }
        }
    });
}

// تشغيل البوت مع معالجة الأخطاء الأولية
startNajmBot().catch(err => console.error("Critical Error:", err));
