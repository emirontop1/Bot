import telegram
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters
import requests
import io
import re
import random
import string

# --- BOT TOKEN'I ---
# NOT: Railway'de bir ortam değişkeni (Environment Variable) olarak saklamak daha güvenlidir!
TOKEN = '8280902341:AAEQvYIlhpBfcI8X6KviiWkzIck-leeoqHU' 

# Obfuscation Seçenekleri (Global ayarlar)
SETTINGS = {
    'encrypt_strings': True,     # Tüm stringleri gizle
    'minify': True,              # Yorumları ve gereksiz boşlukları kaldır
    'use_load': True             # Lua'nın load() veya loadstring() fonksiyonunu kullan
}

# --------------------------------------------------------------------------------------
# LUA OBFUSCATION MANTIĞI
# --------------------------------------------------------------------------------------

# Basit Hex String Şifreleyici
def string_to_hex_lua(text):
    """Metni \xNN formatında birleştirilmiş Lua string'ine çevirir ve boyutu şişirir."""
    # Ters eğik çizgileri korumak için kaçış karakteri ekle (\\)
    text = text.replace('\\', '\\\\') 
    # Tırnakları koru
    text = text.replace('"', '\\"')
    
    # Lua'da birleştirilmiş string olarak döndürür
    hex_parts = []
    for char in text:
        hex_parts.append(f'\\x{ord(char):02x}')
    
    # Boyutu şişiren, 'load' ile çalıştırılabilir bir Lua stringi oluşturur.
    return f'("{"".join(hex_parts)}")'


# Ana Obfuscation Fonksiyonu
def obfuscate_lua_code(lua_code: str) -> str:
    code = lua_code
    
    # 1. Minify (Yorumları ve boşlukları kaldırarak kodun boyutunu optimize et)
    if SETTINGS['minify']:
        # Tek satırlık yorumları kaldır
        code = re.sub(r'--[^\n]*', '', code)
        # Birden fazla yeni satırı ve gereksiz boşlukları tek boşluğa indir
        code = re.sub(r'\s+', ' ', code).strip()

    # 2. String Gizleme (string_to_hex_lua fonksiyonu ile boyutu şişirir)
    if SETTINGS['encrypt_strings']:
        # Tırnak içindeki stringleri bul ve string_to_hex_lua ile değiştir
        # game:GetService() gibi global isimlere dokunmamak için sadece string sabitlerini hedef alıyoruz.
        def replace_string(match):
            return string_to_hex_lua(match.group(1))
        
        # Çift tırnaklı stringler
        code = re.sub(r'"([^"]*)"', replace_string, code)
        # Tek tırnaklı stringler
        code = re.sub(r"'([^']*)'", replace_string, code)

    # 3. Kodu Tek Bir Stringe Sarma ve Load İle Yürütme (Bytecode gibi görünür)
    # Gizlenmiş kodu bir string'e dönüştür. Bu, orijinal 1KB'lık kodun 10KB olmasına neden olan ana adımdır.
    hidden_code_string = string_to_hex_lua(code)
    
    # Lua'da kodu çalıştıran wrapper (sarmalayıcı)
    loader_func = 'load' if SETTINGS['use_load'] else 'loadstring'
    
    # Nihai şişirilmiş ve gizlenmiş Lua kodu
    final_code = (
        f'--! KOD GİZLENDİ VE ŞİŞİRİLDİ. YÜRÜTME FONKSİYONU: {loader_func.upper()}\n'
        f'local L = {hidden_code_string}\n' # Şişirilmiş string
        f'local R = {loader_func}(L)\n'
        f'R()\n'
    )
    
    # Not: Tüm local'leri üste çıkarma (hoisting), Lua dilbilgisi kurallarını gerektirir ve
    # bu karmaşıklıkta bir Python kodunda güvenli bir şekilde yapılamaz.
    # Ancak, kodu stringe sararak zaten tüm mantığı gizlemiş oluyoruz.
    
    return final_code

# --------------------------------------------------------------------------------------
# TELEGRAM BOT İŞLEYİCİLERİ
# --------------------------------------------------------------------------------------

# Ayar menüsü klavyesini oluşturur
def create_settings_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(f"Loader Türü: {'✅ load()' if SETTINGS['use_load'] else '❌ loadstring() (Eski Lua)'}", callback_data='toggle_use_load')],
        [InlineKeyboardButton(f"String Gizleme/Şişirme: {'✅ AÇIK' if SETTINGS['encrypt_strings'] else '❌ KAPALI'}", callback_data='toggle_encrypt_strings')],
        [InlineKeyboardButton(f"Yorumları/Boşlukları Kaldır (Minify): {'✅ AÇIK' if SETTINGS['minify'] else '❌ KAPALI'}", callback_data='toggle_minify')],
        [InlineKeyboardButton("⬆️ Obfuscate Edilecek Lua Dosyasını Gönder ⬆️", callback_data='info_send_file')]
    ])


async def start_command(update: Update, context: Application.CallbackContext) -> None:
    """/start komutu geldiğinde çalışır."""
    await update.message.reply_text(
        '🚀 **Gelişmiş Lua Obfuscator Botuna** hoş geldiniz!\n\n'
        'Bu bot kodu stringlere sarar, boyutu şişirir ve gizler.\n'
        'Lütfen aşağıdaki seçenekleri ayarlayın ve ardından **.lua** dosyanızı gönderin.',
        reply_markup=create_settings_keyboard(),
        parse_mode='Markdown'
    )

async def button_callback(update: Update, context: Application.CallbackContext) -> None:
    """Inline klavye düğmelerinden gelen yanıtları işler."""
    query = update.callback_query
    await query.answer() # Butonun yüklendiğini göster

    action = query.data

    if action.startswith('toggle_'):
        setting_key = action.replace('toggle_', '')
        SETTINGS[setting_key] = not SETTINGS.get(setting_key) # Ayarı tersine çevir
        
        # Mesajı yeni ayarlarla güncelle
        await query.edit_message_text(
            '🚀 **Gelişmiş Lua Obfuscator Botuna** hoş geldiniz!\n\n'
            'Bu bot kodu stringlere sarar, boyutu şişirir ve gizler.\n'
            'Lütfen aşağıdaki seçenekleri ayarlayın ve ardından **.lua** dosyanızı gönderin.',
            reply_markup=create_settings_keyboard(),
            parse_mode='Markdown'
        )
    elif action == 'info_send_file':
        await query.message.reply_text('Harika! Şimdi **.lua** dosyanızı sohbet ekranına yükleyin.')


async def handle_document(update: Update, context: Application.CallbackContext) -> None:
    """Kullanıcı bir dosya gönderdiğinde çalışır."""
    document = update.message.document
    chat_id = update.effective_chat.id

    # Sadece Lua dosyalarını kontrol et
    if not document.file_name.lower().endswith('.lua'):
        await update.message.reply_text('Lütfen sadece bir **.lua** dosyası gönderin.', parse_mode='Markdown')
        return

    message = await update.message.reply_text('Dosya alınıyor ve **GÜÇLÜ GİZLEME** uygulanıyor... Lütfen bekleyin.', parse_mode='Markdown')

    try:
        # 1. Dosya bilgilerini al
        file_id = document.file_id
        file_info = await context.bot.get_file(file_id)
        
        # 2. Dosyayı indir
        file_url = file_info.file_path
        response = requests.get(file_url)
        lua_code = response.content.decode('utf-8')

        # 3. Obfuscation işlemini yap
        obfuscated_code = obfuscate_lua_code(lua_code)
        
        # 4. Obfuscate edilmiş kodu bir IO buffer'ına yaz (dosya oluşturmaya gerek kalmaz)
        obfuscated_file = io.BytesIO(obfuscated_code.encode('utf-8'))
        obfuscated_file.name = f"MEGA_OBFUSCATED_{document.file_name}"

        # 5. Dosyayı kullanıcıya geri gönder
        await context.bot.send_document(
            chat_id=chat_id,
            document=obfuscated_file,
            caption=(
                f"✅ **Mega Gizleme Başarılı!** Kodunuzun boyutu şişirildi ve gizlendi.\n"
                f"Kullanılan Loader: **{('load()' if SETTINGS['use_load'] else 'loadstring()')}**\n"
            ),
            parse_mode='Markdown'
        )
        
    except Exception as e:
        await context.bot.send_message(
            chat_id=chat_id,
            text=f'❌ Dosya işlenirken kritik bir hata oluştu: `{e}`',
            parse_mode='Markdown'
        )
    finally:
        # Bekleme mesajını sil
        await context.bot.delete_message(chat_id=chat_id, message_id=message.message_id)


def main() -> None:
    """Botu çalıştıran ana fonksiyon."""
    # Bot uygulamasını oluştur
    application = Application.builder().token(TOKEN).build()

    # İşleyicileri ekle
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CallbackQueryHandler(button_callback))
    application.add_handler(MessageHandler(filters.Document.ALL, handle_document)) # Tüm belgeleri dinle

    print("Python Lua Obfuscator Botu çalışıyor... (Polling Modu)")
    # Botu başlat
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
