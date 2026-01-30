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

// --- إعداد سيرفر الويب لـ Render ---
const app = express();
app.get('/', (req, res) => res.send('Najm Bot is Running... ✅'));
app.listen(process.env.PORT || 10000, () => console.log('🌐 Web Server Ready'));

async function startNajmBot() {
    // إعداد الجلسة
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        logger: pino({ level: 'silent' }),
        // متصفح Linux Chrome مستقر جداً للأكواد
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        printQRInTerminal: false
    });

    // حفظ التغييرات في الجلسة
    sock.ev.on('creds.update', saveCreds);

    // --- إدارة الاتصال وطلب الكود ---
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔄 انقطع الاتصال، جاري إعادة المحاولة:', shouldReconnect);
            if (shouldReconnect) startNajmBot();
        } 
        
        else if (connection === 'open') {
            console.log('✅ تم الاتصال بنجاح! البوت جاهز للعمل.');
        }

        // منطق طلب كود الربط: يعمل فقط إذا لم يكن مسجلاً وبدأ الاتصال
        if (!sock.authState.creds.registered && !qr) {
            let phone = process.env.PHONE_NUMBER;
            if (phone) {
                phone = phone.replace(/[^0-9]/g, '');
                console.log(`\n[نظام النجم] 🛡️ جاري طلب كود الربط للرقم: ${phone}`);
                
                // انتظار 6 ثوانٍ لضمان استقرار السوكيت تماماً قبل الطلب
                await delay(6000); 

                try {
                    const code = await sock.requestPairingCode(phone);
                    console.log(`\n************************************`);
                    console.log(`🚀 كود الربط الخاص بك هو: ${code}`);
                    console.log(`************************************\n`);
                } catch (err) {
                    console.error('❌ خطأ في طلب الكود (ربما السيرفر مضغوط):', err.message);
                }
            } else {
                console.log('❌ خطأ: يرجى إضافة PHONE_NUMBER في متغيرات البيئة.');
            }
        }
    });

    // --- محرك الردود Gemini ---
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (text) {
            try {
                // تفعيل حالة "جاري الكتابة"
                await sock.sendPresenceUpdate('composing', remoteJid);

                const result = await model.generateContent(text);
                const response = await result.response;
                
                await sock.sendMessage(remoteJid, { text: response.text() });
            } catch (e) {
                console.error("Gemini Error:", e.message);
            }
        }
    });
}

// بدء التشغيل
startNajmBot().catch(err => console.error("Critical Error:", err));
