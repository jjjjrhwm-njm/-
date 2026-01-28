import requests
import time
import webbrowser
import os

# --- [ إعدادات الراشد - نجم الإبداع ] ---
BASE_URL = "https://waha-latest-r55z.onrender.com"
API_KEY = "0564b7ccca284292bd555fe8ae91b819" 
HEADERS = {"X-Api-Key": API_KEY, "Content-Type": "application/json"}
SESSION = "default"

def start_bot_engine():
    print("🧹 1. تنظيف الجلسات القديمة...")
    requests.delete(f"{BASE_URL}/api/sessions/{SESSION}", headers=HEADERS)
    
    print("🏗️ 2. إنشاء جلسة جديدة سليمة...")
    requests.post(f"{BASE_URL}/api/sessions", json={"name": SESSION}, headers=HEADERS)
    
    print("⚡ 3. تشغيل المحرك (Wake up)...")
    requests.post(f"{BASE_URL}/api/sessions/{SESSION}/start", headers=HEADERS)
    
    print("⏳ 4. انتظر 20 ثانية لتجهيز الرمز (تلقائياً)...")
    time.sleep(20)
    
    print("📸 5. جلب كود الـ QR الآن...")
    qr_url = f"{BASE_URL}/api/screenshot?session={SESSION}"
    
    # محاولة جلب الصورة وحفظها
    res = requests.get(qr_url, headers=HEADERS)
    if res.status_code == 200:
        with open("whatsapp_qr.png", "wb") as f:
            f.write(res.content)
        print("✅ تم! كود الـ QR جاهز في ملف: whatsapp_qr.png")
        
        # فتح الصورة تلقائياً في متصفحك أو عارض الصور
        full_path = os.path.abspath("whatsapp_qr.png")
        webbrowser.open(f"file://{full_path}")
    else:
        print(f"❌ فشل جلب الكود، الحالة: {res.status_code}. جرب تشغيل الكود مرة أخرى بعد ثوانٍ.")

if __name__ == "__main__":
    start_bot_engine()
