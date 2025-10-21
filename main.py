import io, os, cv2, numpy as np
from PIL import Image
from telegram import Update
from telegram.ext import Updater, MessageHandler, Filters, CallbackContext

TOKEN = "8350124542:AAHwsh0LksJAZOW-hHTY1BTu5i8-XKGFn18"

FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
EMOJI_PATH = "smile.png"

def overlay_emoji(base, emoji, box):
    x, y, w, h = box
    emoji_resized = emoji.resize((w, h))
    base.paste(emoji_resized, (x, y), emoji_resized)

def process(img_bytes):
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = FACE_CASCADE.detectMultiScale(gray, 1.1, 5, minSize=(30,30))
    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    emoji = Image.open(EMOJI_PATH).convert("RGBA")
    for f in faces:
        overlay_emoji(pil_img, emoji, f)
    buf = io.BytesIO()
    pil_img.convert("RGB").save(buf, "JPEG")
    buf.seek(0)
    return buf

def on_photo(update: Update, context: CallbackContext):
    file = update.message.photo[-1].get_file()
    bio = io.BytesIO()
    file.download(out=bio)
    bio.seek(0)
    result = process(bio.read())
    update.message.reply_photo(result, caption="Sansürlendi (deneme).")

def main():
    updater = Updater(TOKEN, use_context=True)
    dp = updater.dispatcher
    dp.add_handler(MessageHandler(Filters.photo, on_photo))
    updater.start_polling()
    updater.idle()

if __name__ == "__main__":
    main()



python main.py
