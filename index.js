// index.js
import { Telegraf } from "telegraf";

// GÜNCELLE: Kendi bot token'ınızla DEĞİŞTİRİN
const BOT_TOKEN = "8350124542:AAHwsh0LksJAZOW-hHTY1BTu5i8-XKGFn18";
if (!BOT_TOKEN) {
    console.error("HATA: BOT_TOKEN tanımlanmadı. Lütfen index.js dosyasını güncelleyin.");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// =========================================================================
// YARDIMCI FONKSİYONLAR
// =========================================================================

/**
 * Sayısal değeri para birimi olarak formatlar (Örn: $1,234.56)
 */
function formatCurrency(value) {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Büyük sayıları formatlar (Örn: 1,234,567,890)
 */
function formatNumber(value) {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * CoinGecko API'den tek bir kripto para biriminin detaylı piyasa verilerini çeker.
 */
async function getCoinDetails(coinId, currency = "usd") {
    const API_URL = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&ids=${coinId}&sparkline=false`;

    try {
        const response = await fetch(API_URL, { timeout: 10000 });
        if (!response.ok) {
            throw new Error(`HTTP Hata: ${response.status}`);
        }
        const data = await response.json();
        
        // API tek elemanlı bir liste döndürür
        if (data && data.length > 0) {
            return data[0];
        } else {
            return null;
        }
    } catch (error) {
        console.error(`Kripto API Hatası (${coinId}):`, error.message);
        return null;
    }
}

// =========================================================================
// TELEGRAM İŞLEYİCİLERİ
// =========================================================================

bot.start(async (ctx) => {
    await ctx.reply(
        `Merhaba ${ctx.from.first_name}! Ben Gelişmiş Kripto Analiz Botu.`,
    );
    await ctx.reply(
        "Bir kripto paranın detaylarını görmek için:\n"
        + "Örn: `/detay bitcoin` veya `/detay ethereum`",
        { parse_mode: 'Markdown' }
    );
});

bot.command('detay', async (ctx) => {
    // Komut argümanlarını al (örn: ['bitcoin'])
    const args = ctx.message.text.split(/\s+/).slice(1);

    if (args.length === 0) {
        return ctx.reply("Lütfen detayını görmek istediğiniz kripto paranın ID'sini girin.\nÖrn: `/detay bitcoin`");
    }

    const coinId = args[0].toLowerCase();
    
    await ctx.reply(`'${coinId.toUpperCase()}' için detaylı veriler çekiliyor...`);
    
    // Veriyi çek
    const data = await getCoinDetails(coinId);
    
    if (!data) {
        return ctx.reply(`Üzgünüm, '${coinId}' adında bir kripto para bulunamadı veya API'den veri alınamadı.`);
    }

    // Verileri çıkar
    const price = data.current_price;
    const marketCap = data.market_cap;
    const circulatingSupply = data.circulating_supply;
    const high24h = data.high_24h;
    const low24h = data.low_24h;
    const rank = data.market_cap_rank;
    const change24h = data.price_change_percentage_24h;
    
    // Mesajı oluştur
    const emoji = change24h >= 0 ? "🟢" : "🔴";
    
    const message = (
        `${emoji} **${data.name} (${data.symbol.toUpperCase()}) Detaylı Analiz**\n\n`
        + `**🏆 Sıralama:** #${rank}\n\n`
        
        + `**💵 Güncel Fiyat:** ${formatCurrency(price)}\n`
        + `   24s Yüksek: ${formatCurrency(high24h)}\n`
        + `   24s Düşük: ${formatCurrency(low24h)}\n`
        + `   24s Değişim: ${change24h ? `${change24h.toFixed(2)}%` : 'N/A'}\n\n`
        
        + `**🌐 Piyasa Verileri**\n`
        + `   Piyasa Değeri: ${formatCurrency(marketCap)}\n`
        + `   Dolaşımdaki Arz: ${formatNumber(circulatingSupply)}\n`
    );

    await ctx.reply(message, { parse_mode: 'Markdown' });
});


bot.launch().then(() => {
    console.log("🚀 Kripto Botu çalışıyor!");
});

// Bot durdurma mekanizmaları
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

