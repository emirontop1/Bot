const TelegramBot = require('node-telegram-bot-api');

// BOT TOKEN'I DOĞRUDAN KOD İÇİNE YAZILDI.
// UYARI: Güvenlik için, gerçek projelerde bunu Environment Variable olarak kullanmak daha iyidir.
const token = '8280902341:AAEQvYIlhpBfcI8X6KviiWkzIck-leeoqHU'; 

// Polling modunda bir bot örneği oluşturun (Küçük projeler ve testler için uygundur)
const bot = new TelegramBot(token, { polling: true });

console.log('Telegram Bot çalışıyor... Polling modu aktif.');

// /start komutunu dinleyen bir handler (işleyici)
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.first_name || msg.from.username || 'Kullanıcı';

  // Kullanıcıya gönderilecek karşılama mesajı
  const welcomeMessage = `Merhaba ${username}! 👋\n\nBu, token'ı doğrudan kodlanmış Railway üzerinde çalışan basit bir Node.js botudur.`;

  // Mesajı gönder
  bot.sendMessage(chatId, welcomeMessage);
  console.log(`[${chatId}] /start komutu alındı.`);
});

// Gelen tüm metin mesajlarını yakalayan bir handler (işleyici)
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  
  // Eğer mesaj sadece bir komut değilse
  if (msg.text && !msg.text.startsWith('/')) {
      // Gelen mesajı tekrar et
      bot.sendMessage(chatId, `Sen dedin ki: "${msg.text}"`);
  }
});

// Hata yönetimi 
bot.on('polling_error', (error) => {
  // Polling hatalarını konsola yazdır
  console.error("Polling Hatası:", error.code, error.message);
});
