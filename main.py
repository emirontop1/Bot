import telegram
from telegram.ext import Updater, MessageHandler
from telegram import ext # Yeni filters ve sabitler bu modülde
from deepface import DeepFace
import cv2
import numpy as np
import io
import os

# ----------------------------------------------------------------------
# YAPILANDIRMA
# ----------------------------------------------------------------------

# Railway Ortam Değişkeninden token'ı oku. Yerel test için buraya token'ı girin.
# Railway'e dağıtırken "TELEGRAM_TOKEN" değişkenini ayarlamanız yeterli.
TOKEN = '8350124542:AAHwsh0LksJAZOW-hHTY1BTu5i8-XKGFn18'

# Bulanıklık şiddetini belirler (Tek sayı olmalı)
# Ne kadar büyükse, o kadar bulanık olur. (Örn: 51x51)
BLUR_KERNEL_SIZE = (51, 51) 

# ----------------------------------------------------------------------
# YÜZ SANSÜRLEME İŞLEVİ (Bulanıklık Sansürü)
# ----------------------------------------------------------------------

def censor_faces_with_blur(image_data):
    # Görüntü verisini (bytes) OpenCV formatına dönüştürme
    nparr = np.frombuffer(image_data, np.uint8)
    opencv_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # DeepFace yüz tespiti
    try:
        # DeepFace ile yüz tespiti. Sonuç olarak yüzün bounding box'ını (x, y, w, h) alacağız.
        # 'opencv' hızlı bir detektördür. Daha doğru sonuçlar için 'retinaface' deneyebilirsiniz.
        detections = DeepFace.extract_faces(
            img_path=opencv_image, 
            detector_backend='opencv', 
            enforce_detection=False # Yüz bulamazsa hata vermeyi engeller
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
        
        # Sınırları kontrol et ve düzelt (Görüntü dışına taşmayı engelle)
        y = max(0, y)
        x = max(0, x)
        h = min(opencv_image.shape[0] - y, h)
        w = min(opencv_image.shape[1] - x, w)

        # Yüz bölgesini (ROI - Region of Interest) al
        face_roi = opencv_image[y:y+h, x:x+w]
        
        # Yüz bölgesine bulanıklık uygula
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
    
    # Güvenlik kontrolü
    if not TOKEN or TOKEN == "BURAYA_TEST_TOKENINI_GIR":
         context.bot.send_message(chat_id=chat_id, text="HATA: Bot token'ı ayarlanmadı. Lütfen Railway/yerel ayarlarınızı kontrol edin.")
         return
    
    context.bot.send_message(chat_id=chat_id, text="Fotoğraf alınıyor ve yüzler sansürleniyor... Bu ilk çalıştırmada uzun sürebilir.")
    
    try:
        # En yüksek çözünürlüklü fotoğrafı al
        file_id = update.message.photo[-1].file_id
        new_file = context.bot.get_file(file_id)
        
        photo_data = io.BytesIO()
        new_file.download(out=photo_data)
        photo_data.seek(0)

        # Sansürleme işlevini çağır
        censored_photo_bytes = censor_faces_with_blur(photo_data.read())
        
        # İşlenmiş fotoğrafı geri gönder
        context.bot.send_photo(chat_id=chat_id, photo=censored_photo_bytes)
        
    except Exception as e:
        print(f"İşleme sırasında beklenmedik bir hata oluştu: {e}")
        context.bot.send_message(chat_id=chat_id, text=f"Üzgünüm, fotoğrafı işlerken kritik bir hata oluştu. Hata: {str(e)}")
        

def main():
    """Botu çalıştıran ana fonksiyon."""
    if not TOKEN or TOKEN == "BURAYA_TEST_TOKENINI_GIR":
        print("HATA: Telegram Bot Token ayarlanmamış. Lütfen TELEGRAM_TOKEN ortam değişkenini ayarlayın.")
        return
        
    # Updater'ı başlat
    updater = Updater(TOKEN, use_context=True)
    dp = updater.dispatcher

    # Komut ve Mesaj İşleyicileri
    dp.add_handler(telegram.ext.CommandHandler("start", start))
    
    # Düzeltilmiş import: Filters yerine ext.filters.PHOTO kullanılır
    dp.add_handler(MessageHandler(ext.filters.PHOTO, handle_photo))

    print("Bot çalışıyor...")
    # Botu başlat
    updater.start_polling()
    updater.idle()

if __name__ == '__main__':
    main()
