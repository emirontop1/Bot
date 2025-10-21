import logging
import os
from telegram import Update
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters, CallbackContext
from deepface import DeepFace
from PIL import Image

# Token'ınızı buraya yapıştırın
TELEGRAM_TOKEN = "8350124542:AAHwsh0LksJAZOW-hHTY1BTu5i8-XKGFn18"

# Logging'i etkinleştir (hataları görmek için)
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Emoji dosyasının adı
EMOJI_PATH = "emoji.png"

def start(update: Update, context: CallbackContext) -> None:
    """/start komutu verildiğinde çalışır."""
    update.message.reply_text(
        'Merhaba! Sansürlenmesini istediğiniz yüzlerin olduğu bir fotoğraf gönderin.'
    )

def help_command(update: Update, context: CallbackContext) -> None:
    """/help komutu verildiğinde çalışır."""
    update.message.reply_text('Bana bir fotoğraf gönderin, içindeki tüm yüzleri sansürleyeyim.')

def process_image(update: Update, context: CallbackContext) -> None:
    """Kullanıcı fotoğraf gönderdiğinde çalışır."""
    
    # Kullanıcıyı bekletmemek için "Yazıyor..." durumu gönder
    context.bot.send_chat_action(
        chat_id=update.effective_chat.id, 
        action="upload_photo"
    )

    try:
        # Gelen fotoğrafın en yüksek çözünürlüklü halini al
        photo_file = update.message.photo[-1].get_file()
        
        # Fotoğrafı geçici olarak diske indir
        input_filename = f"input_{update.message.message_id}.jpg"
        output_filename = f"output_{update.message.message_id}.jpg"
        
        photo_file.download(input_filename)
        logger.info(f"Fotoğraf indirildi: {input_filename}")

        # --- DeepFace ile Yüz Algılama ---
        # DeepFace.analyze, bir fotoğraftaki yüzleri ve özelliklerini bulur.
        # 'region' anahtarı bize yüzün koordinatlarını (x, y, genişlik, yükseklik) verir.
        # enforce_detection=True, yüz bulamazsa hata vermesini sağlar.
        try:
            detected_faces = DeepFace.analyze(
                img_path=input_filename, 
                actions=['emotion'], # Sadece bir eylem belirtmek yeterli, en hızlısı
                enforce_detection=True
            )
        except ValueError:
            # DeepFace yüz bulamayınca ValueError fırlatır
            logger.info("Fotoğrafta yüz bulunamadı.")
            update.message.reply_text("Bu fotoğrafta sansürlenecek bir yüz bulamadım.")
            os.remove(input_filename) # Geçici dosyayı sil
            return

        # --- Pillow ile Sansürleme ---
        image = Image.open(input_filename)
        emoji = Image.open(EMOJI_PATH).convert("RGBA") # Şeffaflık için RGBA

        logger.info(f"Toplam {len(detected_faces)} adet yüz bulundu.")

        for face in detected_faces:
            # Yüzün koordinatlarını al
            region = face['region']
            x, y, w, h = region['x'], region['y'], region['w'], region['h']
            
            # Emojiyi yüzün boyutuna göre yeniden boyutlandır
            resized_emoji = emoji.resize((w, h))
            
            # Emojiyi yüzün üzerine yapıştır
            # (resized_emoji) 3. parametre olarak maskeleme yapar (şeffaf alanlar yapışmaz)
            image.paste(resized_emoji, (x, y), resized_emoji)

        # Yeni fotoğrafı diske kaydet
        image.save(output_filename)
        logger.info(f"Fotoğraf sansürlendi ve kaydedildi: {output_filename}")

        # Sansürlenmiş fotoğrafı kullanıcıya geri gönder
        with open(output_filename, 'rb') as photo:
            update.message.reply_photo(photo=photo, caption="İşte sansürlenmiş fotoğraf!")

    except Exception as e:
        logger.error(f"Hata oluştu: {e}")
        update.message.reply_text(f"Bir hata oluştu, lütfen tekrar deneyin. Hata: {e}")
    
    finally:
        # Geçici dosyaları temizle
        if os.path.exists(input_filename):
            os.remove(input_filename)
        if os.path.exists(output_filename):
            os.remove(output_filename)


def main() -> None:
    """Botu başlatır."""
    # Updater'ı oluştur ve token'ı ver
    updater = Updater(TELEGRAM_TOKEN)

    # Dispatcher'ı al (komutları/mesajları yönetmek için)
    dispatcher = updater.dispatcher

    # Farklı komutlar için handler'lar (işleyiciler) ekle
    dispatcher.add_handler(CommandHandler("start", start))
    dispatcher.add_handler(CommandHandler("help", help_command))

    # Fotoğraf mesajları için handler ekle
    # Filters.photo, sadece fotoğraf tipindeki mesajları yakalar
    dispatcher.add_handler(MessageHandler(Filters.photo, process_image))

    # Botu çalıştırmaya başla
    updater.start_polling()
    logger.info("Bot başlatıldı, mesaj bekleniyor...")

    # Botu durdurmak için Ctrl+C'ye basana kadar çalıştır
    updater.idle()


if __name__ == '__main__':
    main()
