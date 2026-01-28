import os
import requests
from flask import Flask, Response, redirect

app = Flask(__name__)

# --- [ إعدادات نجم الإبداع ] ---
WAHA_URL = "https://waha-latest-r55z.onrender.com"
API_KEY = "0564b7ccca284292bd555fe8ae91b819"
HEADERS = {"X-Api-Key": API_KEY}

@app.route('/')
def get_qr():
    try:
        # 1. جلب حالة الجلسة مباشرة بدون حذف أو تعقيد
        status_res = requests.get(f"{WAHA_URL}/api/sessions/default", headers=HEADERS, timeout=5)
        
        # 2. إذا لم تكن الجلسة موجودة أو متوقفة، نقوم ببدئها في الخلفية
        if status_res.status_code != 200:
            requests.post(f"{WAHA_URL}/api/sessions", json={"name": "default"}, headers=HEADERS)
            requests.post(f"{WAHA_URL}/api/sessions/default/start", headers=HEADERS)
            return "⏳ المحرك يستعد.. انتظر 10 ثوانٍ ثم حدث الصفحة (Refresh).", 202

        # 3. إذا كانت الجلسة موجودة، نجلب لقطة الشاشة فوراً
        qr_res = requests.get(f"{WAHA_URL}/api/screenshot?session=default", headers=HEADERS, timeout=10)
        
        if qr_res.status_code == 200:
            return Response(qr_res.content, mimetype='image/png')
        else:
            return "⚠️ الكود يتم توليده حالياً.. انتظر قليلاً ثم حدث الصفحة.", 503

    except Exception as e:
        return f"🛑 خطأ في السيرفر: {str(e)}", 500

if __name__ == "__main__":
    # تأكد من الربط بالبورت الصحيح لـ Render
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
