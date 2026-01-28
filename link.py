import os
import requests
import time
from flask import Flask, Response

app = Flask(__name__)

# --- [ إعدادات الراشد - نجم الإبداع ] ---
BASE_URL = "https://waha-latest-r55z.onrender.com"
API_KEY = "0564b7ccca284292bd555fe8ae91b819" 
HEADERS = {"X-Api-Key": API_KEY, "Content-Type": "application/json"}
SESSION = "default"

@app.route('/')
def get_qr_now():
    # 1. تصفير الجلسة القديمة لضمان عدم التعليق
    requests.delete(f"{BASE_URL}/api/sessions/{SESSION}", headers=HEADERS)
    # 2. إنشاء وتشغيل الجلسة فوراً
    requests.post(f"{BASE_URL}/api/sessions", json={"name": SESSION}, headers=HEADERS)
    requests.post(f"{BASE_URL}/api/sessions/{SESSION}/start", headers=HEADERS)
    
    # 3. الانتظار قليلاً لتوليد الكود
    time.sleep(15)
    
    # 4. جلب الصورة وإرسالها للمتصفح مباشرة
    qr_url = f"{BASE_URL}/api/screenshot?session={SESSION}"
    res = requests.get(qr_url, headers=HEADERS)
    
    if res.status_code == 200:
        return Response(res.content, mimetype='image/png')
    else:
        return f"⚠️ الكود جاري التحضير.. حدث الصفحة بعد 5 ثوانٍ. (الحالة: {res.status_code})"

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 10000)))
