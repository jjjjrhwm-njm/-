import os
import requests
import time
from flask import Flask, Response, render_template_string

app = Flask(__name__)

# --- [ إعدادات نجم الإبداع - المطور راشد ] ---
WAHA_URL = "https://waha-latest-r55z.onrender.com"
API_KEY = "0564b7ccca284292bd555fe8ae91b819" 
HEADERS = {"X-Api-Key": API_KEY}

# واجهة نظيفة مع تحديث تلقائي كل 5 ثوانٍ
HTML_PAGE = """
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>ربط واتساب نجم الإبداع</title>
    <meta http-equiv="refresh" content="5">
    <style>
        body { text-align: center; font-family: Arial, sans-serif; padding-top: 50px; background: #f0f2f5; }
        .box { background: white; padding: 30px; display: inline-block; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        h2 { color: #25D366; }
        .info { color: #666; margin-bottom: 20px; }
        .error-msg { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <div class="box">
        <h2>نجم الإبداع - ربط الواتساب</h2>
        <p class="info">سيظهر الكود بالأسفل، امسحه بجوالك فوراً</p>
        <div style="min-height: 250px;">
            <img src="/qr_image" style="max-width: 300px; border: 2px solid #25D366; border-radius: 10px;" 
                 alt="جاري تحميل الكود أو إظهار حالة الخطأ...">
        </div>
        <p style="font-size: 0.8em; color: #999;">آخر تحديث للصفحة: {{ time }}</p>
    </div>
</body>
</html>
"""

@app.route('/')
def home():
    """فحص الجلسة وإعادة تشغيلها إذا كانت عالقة"""
    try:
        # فحص الحالة الحالية
        res = requests.get(f"{WAHA_URL}/api/sessions/default", headers=HEADERS, timeout=10)
        
        # إذا كانت الجلسة غير موجودة أو متعطلة (FAILED)، نقوم بتصفيرها
        if res.status_code != 200 or res.json().get('status') != 'RUNNING':
            requests.delete(f"{WAHA_URL}/api/sessions/default", headers=HEADERS)
            requests.post(f"{WAHA_URL}/api/sessions", json={"name": "default"}, headers=HEADERS)
            requests.post(f"{WAHA_URL}/api/sessions/default/start", headers=HEADERS)
    except:
        pass # سنترك محاولة الإصلاح للمرة القادمة لتجنب التأخير
        
    return render_template_string(HTML_PAGE, time=time.strftime('%H:%M:%S'))

@app.route('/qr_image')
def qr_image():
    """هذه الدالة تجلب الصورة أو تطبع رقم الخطأ بوضوح"""
    try:
        # طلب لقطة الشاشة مع مهلة 20 ثانية
        res = requests.get(f"{WAHA_URL}/api/screenshot?session=default", headers=HEADERS, timeout=20)
        
        if res.status_code == 200:
            return Response(res.content, mimetype='image/png')
        else:
            # إذا فشل السيرفر، سنعيد رسالة نصية تظهر مكان الصورة
            return f"❌ خطأ من WAHA: {res.status_code}", 200
    except Exception as e:
        return f"🛑 فشل الاتصال: {str(e)}", 200

if __name__ == "__main__":
    # الربط مع بورت Render التلقائي
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
