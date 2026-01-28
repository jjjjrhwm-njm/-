import os
import requests
import time
from flask import Flask, render_template_string

app = Flask(__name__)

# --- [ إعدادات نجم الإبداع - المطور راشد ] ---
WAHA_URL = "https://waha-latest-r55z.onrender.com"
API_KEY = "0564b7ccca284292bd555fe8ae91b819" 
HEADERS = {"X-Api-Key": API_KEY}

HTML_PAGE = """
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>نجم الإبداع - ربط الواتساب</title>
    <meta http-equiv="refresh" content="7"> <style>
        body { text-align: center; font-family: Arial; padding-top: 50px; background: #f0f2f5; }
        .box { background: white; padding: 30px; display: inline-block; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); width: 350px; }
        h2 { color: #25D366; }
        .qr-container { margin: 20px 0; min-height: 250px; display: flex; align-items: center; justify-content: center; border: 1px dashed #ccc; }
        .btn { background: #d93025; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; text-decoration: none; display: block; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="box">
        <h2>نجم الإبداع</h2>
        <p>سكرتير الراشد - ربط الواتساب</p>
        
        <div class="qr-container">
            {% if qr_url %}
                <img src="{{ qr_url }}" alt="QR Code" style="width: 100%;">
            {% else %}
                <div style="color: #666;">{{ msg }}</div>
            {% endif %}
        </div>

        <p style="font-size: 0.8em; color: #888;">آخر محاولة: {{ now }}</p>
        <hr>
        <p style="font-size: 0.7em;">إذا لم يظهر الكود لأكثر من دقيقة، اضغط هنا:</p>
        <a href="/reset" class="btn">تصفير وإعادة تشغيل الجلسة</a>
    </div>
</body>
</html>
"""

@app.route('/')
def home():
    now = time.strftime('%H:%M:%S')
    try:
        # طلب بيانات الـ QR النصية (خفيفة جداً ولا تسبب 404 مثل الصور)
        res = requests.get(f"{WAHA_URL}/api/default/auth/qr", headers=HEADERS, timeout=10)
        
        if res.status_code == 200:
            qr_data = res.json().get('qr')
            if qr_data:
                # رسم الـ QR باستخدام Google Charts API الموثوقة
                qr_url = f"https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl={qr_data}"
                return render_template_string(HTML_PAGE, qr_url=qr_url, now=now)
            else:
                return render_template_string(HTML_PAGE, msg="✅ الواتساب مربوط حالياً! البوت جاهز.", now=now)
        
        # إذا كان السيرفر لا يزال يقلع
        requests.post(f"{WAHA_URL}/api/sessions/default/start", headers=HEADERS)
        return render_template_string(HTML_PAGE, msg="⏳ السيرفر يستعد.. سيظهر الكود تلقائياً خلال لحظات.", now=now)

    except Exception as e:
        return render_template_string(HTML_PAGE, msg=f"🛑 خطأ اتصال: {str(e)}", now=now)

@app.route('/reset')
def reset():
    """تصفير الجلسة في حال التعليق البرمجي"""
    try:
        requests.delete(f"{WAHA_URL}/api/sessions/default", headers=HEADERS, timeout=10)
        requests.post(f"{WAHA_URL}/api/sessions", json={"name": "default"}, headers=HEADERS)
        requests.post(f"{WAHA_URL}/api/sessions/default/start", headers=HEADERS)
        return "<h1>تم التصفير! انتظر 10 ثوانٍ وارجع للرابط الرئيسي.</h1><a href='/'>اضغط للعودة</a>"
    except:
        return "<h1>فشل التصفير.. حاول يدوياً من Swagger</h1>"

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=10000)
