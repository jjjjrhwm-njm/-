import os
import requests
import time
from flask import Flask, render_template_string, request

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
    <meta http-equiv="refresh" content="7">
    <style>
        body { text-align: center; font-family: Arial; padding-top: 50px; background: #f0f2f5; }
        .box { background: white; padding: 30px; display: inline-block; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); width: 350px; }
        h2 { color: #25D366; }
        .qr-frame { margin: 20px; min-height: 250px; display: flex; align-items: center; justify-content: center; border: 2px dashed #25D366; border-radius: 10px; }
        .status { font-size: 0.9em; color: #666; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="box">
        <h2>نجم الإبداع</h2>
        <p>سكرتير الراشد - ربط الواتساب</p>
        <div class="qr-frame">
            {% if qr_string %}
                <img src="https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl={{ qr_string }}" alt="WhatsApp QR">
            {% else %}
                <div style="padding: 20px;">{{ msg }}</div>
            {% endif %}
        </div>
        <p class="status">آخر تحديث: {{ now }}</p>
        <hr>
        <p style="font-size: 0.7em; color: #999;">بمجرد المسح، سيقوم الذكاء الاصطناعي بالرد تلقائياً.</p>
    </div>
</body>
</html>
"""

@app.route('/')
def home():
    now = time.strftime('%H:%M:%S')
    try:
        # طلب بيانات الـ QR النصية (أخف بـ 100 مرة من الصور)
        res = requests.get(f"{WAHA_URL}/api/sessions/default/auth/qr", headers=HEADERS, timeout=10)
        
        if res.status_code == 200:
            qr_data = res.json().get('qr')
            if qr_data:
                return render_template_string(HTML_PAGE, qr_string=qr_data, now=now)
            return render_template_string(HTML_PAGE, msg="✅ الواتساب مربوط حالياً بنجاح! البوت جاهز.", now=now)
        
        # إيقاظ المحرك إذا كان متوقفاً
        requests.post(f"{WAHA_URL}/api/sessions/default/start", headers=HEADERS)
        return render_template_string(HTML_PAGE, msg="⏳ المحرك يقلع.. سيظهر الكود هنا تلقائياً.", now=now)
    except:
        return render_template_string(HTML_PAGE, msg="🛑 فشل الاتصال بالسيرفر الأساسي.", now=now)

# --- [ مستقبلاً: ضع كود الرد بـ Gemini هنا ] ---
@app.route('/webhook', methods=['POST'])
def webhook():
    return "OK", 200

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=10000)
