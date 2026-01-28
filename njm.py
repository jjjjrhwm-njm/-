import os
import requests
import time
from flask import Flask, Response, render_template_string

app = Flask(__name__)

# --- [ إعدادات نجم الإبداع - المطور راشد ] ---
WAHA_URL = "https://waha-latest-r55z.onrender.com"
API_KEY = "0564b7ccca284292bd555fe8ae91b819" 
HEADERS = {"X-Api-Key": API_KEY}

# واجهة احترافية تقوم بتحديث نفسها تلقائياً
HTML_PAGE = """
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>ربط واتساب نجم الإبداع</title>
    <meta http-equiv="refresh" content="5">
    <style>
        body { text-align: center; font-family: Arial, sans-serif; padding-top: 50px; background: #f0f2f5; color: #333; }
        .box { background: white; padding: 30px; display: inline-block; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); max-width: 400px; }
        h2 { color: #25D366; margin-bottom: 10px; }
        .status-box { background: #e7f3ff; padding: 10px; border-radius: 8px; margin-bottom: 20px; font-size: 0.9em; }
        img { max-width: 100%; border: 2px solid #25D366; border-radius: 10px; }
        .footer { margin-top: 20px; font-size: 0.8em; color: #888; }
    </style>
</head>
<body>
    <div class="box">
        <h2>نجم الإبداع - ربط الواتساب</h2>
        <div class="status-box">
            {{ status_msg }}
        </div>
        <div style="min-height: 250px;">
            <img src="/qr_image?t={{ timestamp }}" alt="جاري جلب كود الـ QR...">
        </div>
        <p class="footer">آخر تحديث: {{ time }}</p>
    </div>
</body>
</html>
"""

@app.route('/')
def home():
    """فحص حالة السيرفر وإبلاغك بالوضع الحقيقي"""
    status_msg = "جاري فحص حالة السيرفر..."
    try:
        # فحص حالة الجلسة
        res = requests.get(f"{WAHA_URL}/api/sessions/default", headers=HEADERS, timeout=10)
        
        if res.status_code == 200:
            status = res.json().get('status', '')
            if status == 'RUNNING':
                status_msg = "✅ السيرفر يعمل؛ امسح الكود الظاهر بالأسفل."
            elif status == 'STARTING':
                status_msg = "⏳ السيرفر يقلع الآن.. انتظر ثواني سيظهر الكود تلقائياً."
            else:
                status_msg = f"⚠️ الحالة الحالية: {status}. جاري محاولة الإصلاح..."
                requests.post(f"{WAHA_URL}/api/sessions/default/start", headers=HEADERS)
        else:
            status_msg = "🔄 الجلسة غير موجودة؛ جاري إنشاؤها الآن..."
            requests.post(f"{WAHA_URL}/api/sessions", json={"name": "default"}, headers=HEADERS)
            requests.post(f"{WAHA_URL}/api/sessions/default/start", headers=HEADERS)
            
    except Exception as e:
        status_msg = f"🛑 خطأ في الاتصال: {str(e)}"

    return render_template_string(HTML_PAGE, status_msg=status_msg, time=time.strftime('%H:%M:%S'), timestamp=int(time.time()))

@app.route('/qr_image')
def qr_image():
    """جلب الصورة الحقيقية (jpeg) كما يطلبها WAHA"""
    try:
        # ملاحظة: السيرفر يرسل الصورة بصيغة image/jpeg
        res = requests.get(f"{WAHA_URL}/api/screenshot?session=default", headers=HEADERS, timeout=20)
        if res.status_code == 200:
            return Response(res.content, mimetype='image/jpeg')
        else:
            return "", 404
    except:
        return "", 404

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
