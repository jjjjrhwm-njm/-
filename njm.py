import os
import requests
import time
from flask import Flask, render_template_string

app = Flask(__name__)

# --- [ إعدادات نجم الإبداع - راشد ] ---
WAHA_URL = "https://waha-latest-r55z.onrender.com"
API_KEY = "0564b7ccca284292bd555fe8ae91b819"
HEADERS = {"X-Api-Key": API_KEY}

HTML_PAGE = """
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>ربط واتساب نجم الإبداع</title>
    <style>
        body { text-align: center; font-family: Arial; padding-top: 50px; background: #f0f2f5; }
        .box { background: white; padding: 30px; display: inline-block; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        h2 { color: #25D366; }
        .qr-frame { margin: 20px; min-height: 250px; }
    </style>
</head>
<body>
    <div class="box">
        <h2>نجم الإبداع - ربط الواتساب</h2>
        <p>امسح الكود التالي بجوالك للربط الفوري:</p>
        <div class="qr-frame">
            {% if qr_string %}
                <img src="https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl={{ qr_string }}" alt="WhatsApp QR">
            {% else %}
                <p style="color: red;">{{ error_msg }}</p>
                <button onclick="location.reload()">إعادة محاولة جلب الكود</button>
            {% endif %}
        </div>
        <p style="font-size: 0.8em; color: #888;">آخر محاولة: {{ time }}</p>
    </div>
</body>
</html>
"""

@app.route('/')
def get_qr():
    try:
        # 1. طلب بيانات الكود النصي (وليس صورة)
        res = requests.get(f"{WAHA_URL}/api/default/auth/qr", headers=HEADERS, timeout=15)
        
        if res.status_code == 200:
            qr_data = res.json().get('qr', '')
            if qr_data:
                return render_template_string(HTML_PAGE, qr_string=qr_data, time=time.strftime('%H:%M:%S'))
            else:
                return render_template_string(HTML_PAGE, error_msg="🔄 الجلسة مرتبطة بالفعل أو جاري التجهيز..", time=time.strftime('%H:%M:%S'))
        
        # 2. إذا لم تكن الجلسة موجودة، نحاول تشغيلها
        requests.post(f"{WAHA_URL}/api/sessions/default/start", headers=HEADERS)
        return render_template_string(HTML_PAGE, error_msg="⏳ المحرك يقلع.. انتظر 10 ثواني وحدث الصفحة.", time=time.strftime('%H:%M:%S'))

    except Exception as e:
        return render_template_string(HTML_PAGE, error_msg=f"🛑 خطأ اتصال: {str(e)}", time=time.strftime('%H:%M:%S'))

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 10000)))
