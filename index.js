const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Token'ınızı buraya yapıştırın (Env kullanmadığınız senaryo için)
const token = '8280902341:AAEQvYIlhpBfcI8X6KviiWkzIck-leeoqHU'; 

const bot = new TelegramBot(token, { polling: true });

// Obfuscation seçenekleri ve varsayılan değerleri
const settings = {
    randomVars: true,
    removeComments: true,
    stringEncryption: false 
};

// ----------------------------------------------------
// BASİT LUA OBFUSCATOR FONKSİYONU
// ----------------------------------------------------
function simpleObfuscate(luaCode, options) {
    let code = luaCode;
    
    // 1. Yorumları Kaldırma
    if (options.removeComments) {
        // Tek satırlık yorumları kaldırır
        code = code.replace(/--.*$/gm, '');
    }

    // 2. Rastgele Değişken İsimleri (Çok basit ve hatalı olabilir)
    if (options.randomVars) {
        // Basitçe: local a = 1, local b = "test" gibi ifadelerdeki değişkenleri değiştirir.
        // Bu, karmaşık kodlarda hata verebilir, sadece demo amaçlıdır.
        const variables = new Set();
        const varMap = {};
        
        // Tüm local değişkenleri bul
        const localRegex = /local\s+([a-zA-Z_]\w*)\s*=/g;
        let match;
        while ((match = localRegex.exec(code)) !== null) {
            variables.add(match[1]);
        }

        // Değişkenler için rastgele isimler oluştur
        variables.forEach(varName => {
            const newName = 'l' + Math.random().toString(36).substring(2, 8);
            varMap[varName] = newName;
        });

        // Kodu değiştir
        for (const [oldName, newName] of Object.entries(varMap)) {
            // Sadece tam kelime eşleşmeleri (kötü bir regex ile)
            const regex = new RegExp(`\\b${oldName}\\b`, 'g');
            code = code.replace(regex, newName);
        }
    }
    
    // String Encryption kısmı çok karmaşık olduğu için bu basit örnekte atlanmıştır.
    
    return '-- Obfuscated by Telegram Bot\n' + code;
}


// ----------------------------------------------------
// BUTONLAR VE İŞLEYİCİLER
// ----------------------------------------------------

// Ayar menüsü klavyesini oluşturur
function createSettingsKeyboard() {
    return {
        inline_keyboard: [
            [{ text: `Rastgele İsimler: ${settings.randomVars ? '✅ AÇIK' : '❌ KAPALI'}`, callback_data: 'toggle_randomVars' }],
            [{ text: `Yorumları Kaldır: ${settings.removeComments ? '✅ AÇIK' : '❌ KAPALI'}`, callback_data: 'toggle_removeComments' }],
            [{ text: `Şifreleme (Şu an Pasif): ❌ KAPALI`, callback_data: 'no_action' }],
            [{ text: '⬆️ Obfuscate Edilecek Dosyayı Gönder ⬆️', callback_data: 'info_send_file' }]
        ]
    };
}

// /start komutu
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        'Merhaba! Lua Obfuscator Botuna hoş geldiniz.\n\n' + 
        'Lütfen aşağıdaki seçenekleri ayarlayın ve ardından .lua dosyanızı gönderin.', 
        { reply_markup: createSettingsKeyboard() }
    );
});

// Inline klavye (toggle) callback işleyicisi
bot.on('callback_query', (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;

    if (action.startsWith('toggle_')) {
        const settingKey = action.replace('toggle_', '');
        // Ayarı tersine çevir
        settings[settingKey] = !settings[settingKey];
        
        // Mesajı yeni ayarlarla güncelle
        bot.editMessageText(msg.text, {
            chat_id: chatId,
            message_id: msg.message_id,
            reply_markup: createSettingsKeyboard()
        });
        
        bot.answerCallbackQuery(callbackQuery.id, `${settingKey} ayarı ${settings[settingKey] ? 'AÇIK' : 'KAPALI'} olarak değiştirildi.`);
        
    } else if (action === 'info_send_file') {
         bot.answerCallbackQuery(callbackQuery.id, 'Şimdi .lua dosyanızı gönderebilirsiniz.');
    } else {
         bot.answerCallbackQuery(callbackQuery.id, 'Bu ayar şu an için pasif.');
    }
});


// ----------------------------------------------------
// DOSYA İŞLEME İŞLEYİCİSİ
// ----------------------------------------------------

bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const document = msg.document;

    // Sadece Lua dosyalarını işle
    if (!document.file_name || !document.file_name.endsWith('.lua')) {
        bot.sendMessage(chatId, 'Lütfen yalnızca bir .lua dosyası gönderin.');
        return;
    }
    
    let sentMessage;
    try {
        // Kullanıcıya bekleme mesajı gönder
        sentMessage = await bot.sendMessage(chatId, 'Dosya alınıyor ve obfuscate ediliyor... Lütfen bekleyin.');

        // 1. Dosyayı indirme linkini al
        const fileLink = await bot.getFileLink(document.file_id);

        // 2. Dosyayı indir
        const response = await axios({
            method: 'GET',
            url: fileLink,
            responseType: 'arraybuffer'
        });
        
        // 3. İndirilen veriyi stringe çevir
        const luaCode = Buffer.from(response.data).toString('utf8');

        // 4. Obfuscation işlemini yap
        const obfuscatedCode = simpleObfuscate(luaCode, settings);
        
        // 5. Obfuscate edilmiş kodu geçici bir dosyaya yaz
        const outputFileName = `obfuscated_${document.file_name}`;
        const tempFilePath = path.join('/tmp', outputFileName);
        fs.writeFileSync(tempFilePath, obfuscatedCode, 'utf8');

        // 6. Dosyayı kullanıcıya geri gönder
        await bot.sendDocument(chatId, tempFilePath, {
            caption: `✅ Dosyanız obfuscate edildi! Kullanılan ayarlar: \n` +
                     `Rastgele İsimler: ${settings.randomVars ? 'AÇIK' : 'KAPALI'}\n` +
                     `Yorumları Kaldır: ${settings.removeComments ? 'AÇIK' : 'KAPALI'}`
        });

        // 7. Geçici dosyayı sil
        fs.unlinkSync(tempFilePath);
        
        // Başlangıç mesajını sil
        bot.deleteMessage(chatId, sentMessage.message_id);

    } catch (error) {
        console.error('Dosya işleme hatası:', error.message);
        bot.sendMessage(chatId, `❌ Dosya işlenirken bir hata oluştu: ${error.message}`);
        
        if (sentMessage) {
             bot.deleteMessage(chatId, sentMessage.message_id);
        }
    }
});

// Hata yönetimi
bot.on('polling_error', (error) => {
  console.error("Polling Hatası:", error.code, error.message);
});

console.log('Lua Obfuscator Botu çalışıyor...');
