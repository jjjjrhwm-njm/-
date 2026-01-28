import os
import requests
import time
from flask import Flask, Response, render_template_string

app = Flask(__name__)

# --- [ إعدادات نجم الإبداع - المطور راشد ] ---
WAHA_URL = "https://waha-latest-r55z.onrender.com"
API_KEY = "0564b7ccca284292bd555fe8ae91b819" 
HEADERS = {"X-Api-Key": API_KEY}

# صفحة HTML ذكية تقوم بتحديث الصورة تلقائياً كل 5 ثوانٍ
HTML_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>ربط واتساب نجم الإبداع</title>
    <meta http-equiv="refresh" content="5">
    <style>
        body { text-align: center; font-family: Arial; padding-top: 50px; background: #f4f4f4; }
        .box { background: white; padding: 20px; display: inline-block; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        h2 { color: #25D366; }
    </style>
</head>
<body>
    <div class="box">
        <h2>نجم الإبداع - ربط الواتساب</h2>
        <p>جاري فحص الكود.. سيظهر هنا تلقائياً خلال ثوانٍ</p>
        <img src="/qr_image" style="width: 300px; border: 1px solid #ccc;">
        <p>آخر تحديث: {{ time }}</p>
    </div>
</body>
</html>
"""

@app.route('/')
def home():
    # فحص الجلسة وتشغيلها إذا كانت متوقفة
    res = requests.get(f"{WAHA_URL}/api/sessions/default", headers=HEADERS)
    if res.status_code != 200 or res.json().get('status') != 'RUNNING':
        requests.delete(f"{WAHA_URL}/api/sessions/default", headers=HEADERS)
        requests.post(f"{WAHA_URL}/api/sessions", json={"name": "default"}, headers=HEADERS)
        requests.post(f"{WAHA_URL}/api/sessions/default/start", headers=HEADERS)
    
    return render_template_string(HTML_PAGE, time=time.strftime('%H:%M:%S'))

@app.route('/qr_image')
def qr_image():
    # جلب صورة الكود مباشرة من السيرفر
    res = requests.get(f"{WAHA_URL}/api/screenshot?session=default", headers=HEADERS)
    if res.status_code == 200:
        return Response(res.content, mimetype='image/png')
    else:
        # إذا لم يجهز الكود بعد، نرسل صورة شفافة أو رسالة
        return "", 404

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 10000)))
