import telegram
from telegram.ext import Updater, MessageHandler, Filters
from deepface import DeepFace
import cv2
import numpy as np
import io
import os

# ----------------------------------------------------------------------
# YAPILANDIRMA
# ----------------------------------------------------------------------

# Ortam değişkeninden bot token'ını oku (Railway/Docker dostu)
TOKEN = '8350124542:AAHwsh0LksJAZOW-hHTY1BTu5i8-XKGFn18'

# Bulanıklık şiddetini belirler (Tek sayı olmalı)
BLUR_KERNEL_SIZE = (51, 51) 

# ----------------------------------------------------------------------
# YÜZ SANSÜRLEME İŞLEVİ (Bulanıklık Sansürü Kullanımı)
# ----------------------------------------------------------------------

def censor_faces_with_blur(image_data):
    # Görüntü verisini (bytes) OpenCV formatına dönüştürme
    nparr = np.frombuffer(image_data, np.uint8)
    opencv_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # DeepFace yüz tespiti
    try:
        # DeepFace ile yüz tespiti. Sonuç olarak yüzün bounding box'ını (x, y, w, h) alacağız.
        detections = DeepFace.extract_faces(
            img_path=opencv_image, 
            detector_backend='opencv', # Hızlı ve genellikle yeterli
            enforce_detection=False 
        )
        
    except Exception as e:
        print(f"DeepFace Hata: {e}")
        return image_data # Hata durumunda orijinal resmi döndür

    faces_detected = 0
    
    # Tespit edilen her yüz için sansür uygula
    for detection in detections:
        # Yüzün koordinatları
        # x, y, w, h
        x, y, w, h = detection['facial_area']['x'], detection['facial_area']['y'], detection['facial_area']['w'], detection['facial_area']['h']
        
        # Yüz bölgesini (ROI - Region of Interest) al
        face_roi = opencv_image[y:y+h, x:x+w]
        
        # Yüz bölgesine bulanıklık uygula
        # BLUR_KERNEL_SIZE ne kadar büyükse, bulanıklık o kadar fazla olur
        blurred_face = cv2.GaussianBlur(face_roi, BLUR_KERNEL_SIZE, 0)
        
        # Bulanıklaşmış yüzü orijinal fotoğrafın üzerine geri yerleştir
        opencv_image[y:y+h, x:x+w] = blurred_face
        faces_detected += 1


    if faces_detected == 0:
        return image_data # Yüz bulunamazsa orijinal resmi gönder

    # İşlenmiş OpenCV görüntüsünü tekrar JPEG bayt verisine dönüştür
    success, encoded_image = cv2.imencode('.jpg', opencv_image)
    if not success:
        return image_data # Kodlama hatası
        
    return encoded_image.tobytes()

# ----------------------------------------------------------------------
# TELEGRAM İŞLEYİCİLERİ
# ----------------------------------------------------------------------

def start(update, context):
    """Bot başlatıldığında gönderilen mesaj."""
    update.message.reply_text(
        'Merhaba! Bana bir fotoğraf gönder, ben de bütün yüzleri bulanıklık (blur) ile sansürleyip sana geri göndereyim.'
    )

def handle_photo(update, context):
    """Bir fotoğraf mesajı geldiğinde çalışır."""
    chat_id = update.message.chat_id
    
    if not TOKEN or TOKEN == "BURAYA_TEST_TOKEN_GIR_VEYE_KALDIR":
         context.bot.send_message(chat_id=chat_id, text="HATA: Bot token'ı ayarlanmadı. Lütfen kodu kontrol edin.")
         return
    
    # Kullanıcıya bekleme mesajı gönder
    context.bot.send_message(chat_id=chat_id, text="Fotoğraf alınıyor ve yüzler sansürleniyor... Lütfen bekleyin.")
    
    # En yüksek çözünürlüklü fotoğrafı al
    file_id = update.message.photo[-1].file_id
    new_file = context.bot.get_file(file_id)
    
    photo_data = io.BytesIO()
    new_file.download(out=photo_data)
    photo_data.seek(0)

    try:
        # Sansürleme işlevini çağır
        censored_photo_bytes = censor_faces_with_blur(photo_data.read())
        
        # İşlenmiş fotoğrafı geri gönder
        context.bot.send_photo(chat_id=chat_id, photo=censored_photo_bytes)
        
    except Exception as e:
        print(f"İşleme sırasında bir hata oluştu: {e}")
        context.bot.send_message(chat_id=chat_id, text=f"Üzgünüm, fotoğrafı işlerken bir hata oluştu. Hata: {str(e)}")
        

def main():
    """Botu çalıştıran ana fonksiyon."""
    if not TOKEN or TOKEN == "BURAYA_TEST_TOKEN_GIR_VEYE_KALDIR":
        print("HATA: Telegram Bot Token ayarlanmamış. Lütfen TELEGRAM_TOKEN ortam değişkenini ayarlayın veya koda ekleyin.")
        return
        
    updater = Updater(TOKEN, use_context=True)
    dp = updater.dispatcher

    dp.add_handler(telegram.ext.CommandHandler("start", start))
    dp.add_handler(MessageHandler(Filters.photo, handle_photo))

    print("Bot çalışıyor...")
    updater.start_polling()
    updater.idle()

if __name__ == '__main__':
    main()

def main():
    updater = Updater(TOKEN, use_context=True)
    dp = updater.dispatcher
    dp.add_handler(MessageHandler(Filters.photo, on_photo))
    updater.start_polling()
    updater.idle()

if __name__ == "__main__":
    main()
def main():
    updater = Updater(TOKEN, use_context=True)
    dp = updater.dispatcher
    dp.add_handler(MessageHandler(Filters.photo, on_photo))
    updater.start_polling()
    updater.idle()

if __name__ == "__main__":
    main()
