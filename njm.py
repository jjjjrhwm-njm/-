import os
import requests
import time
from flask import Flask, Response

app = Flask(__name__)

# --- [ إعدادات نجم الإبداع - راشد ] ---
WAHA_URL = "https://waha-latest-r55z.onrender.com"
API_KEY = "0564b7ccca284292bd555fe8ae91b819"
HEADERS = {"X-Api-Key": API_KEY}

@app.route('/')
def force_qr():
    try:
        # 1. فحص حالة الجلسة
        res = requests.get(f"{WAHA_URL}/api/sessions/default", headers=HEADERS, timeout=5)
        
        # 2. إذا لم تكن الحالة "RUNNING" (جاهزة)، سنقوم بتصفيرها فوراً
        if res.status_code != 200 or res.json().get('status') != 'RUNNING':
            print("🔄 الجلسة عالقة أو غير موجودة.. جاري التصفير والبدء من جديد.")
            requests.delete(f"{WAHA_URL}/api/sessions/default", headers=HEADERS) # حذف القديم
            requests.post(f"{WAHA_URL}/api/sessions", json={"name": "default"}, headers=HEADERS) # إنشاء
            requests.post(f"{WAHA_URL}/api/sessions/default/start", headers=HEADERS) # تشغيل
            return "🔥 تم تصفير المحرك العالق.. انتظر 20 ثانية ثم حدث الصفحة (Refresh).", 202

        # 3. إذا كانت جاهزة، نجلب الكود فوراً
        qr_res = requests.get(f"{WAHA_URL}/api/screenshot?session=default", headers=HEADERS, timeout=10)
        if qr_res.status_code == 200:
            return Response(qr_res.content, mimetype='image/png')
        else:
            return "⏳ الكود يتحدث الآن.. حدث الصفحة بعد ثوانٍ.", 503

    except Exception as e:
        return f"🛑 خطأ في الاتصال بالسيرفر: {str(e)}", 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 10000)))
