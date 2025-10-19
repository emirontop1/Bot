// index.js
import { Telegraf } from "telegraf";

// GÜNCELLE: Kendi bot token'ınızla DEĞİŞTİRİN
const BOT_TOKEN = "8350124542:AAHwsh0LksJAZOW-hHTY1BTu5i8-XKGFn18";
if (!BOT_TOKEN) {
    console.error("HATA: BOT_TOKEN tanımlanmadı.");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Kullanıcı oturum verilerini tutmak için Map
// chatId -> { guiName: string, elements: string[] }
const USER_SESSIONS = new Map();

// =========================================================================
// LUA KOD ÜRETİCİSİ
// Bu, basitleştirilmiş bir GMod/oyun içi Lua GUI framework'üne dayanmaktadır.
// =========================================================================

function generateLuaCode(session) {
    const guiName = session.guiName || "GeneratedGUI";
    const elementsCode = session.elements.join('\n\n    ');

    const fullCode = `
-- Lua GUI Kodu: ${guiName}
-- Bu kod, popüler oyun içi Lua GUI framework'leri (Örn: DarkRP, GMod VGUI) temel alınarak oluşturulmuştur.

local frame = vgui.Create("DFrame")
frame:SetSize(600, 500)
frame:SetTitle("${guiName}")
frame:Center()
frame:SetSizable(false)
frame:SetDraggable(true)
frame:ShowCloseButton(true)
frame:MakePopup()

-- Ana Panel (ScrollPanel olarak kullanabiliriz)
local panel = vgui.Create("DScrollPanel", frame)
panel:Dock(FILL)
panel:DockMargin(5, 30, 5, 5)

-- VGUI elemanları buraya eklenir
${elementsCode}

-- Panelin görünürlüğünü yönetmek için bir işlev
local function ToggleGUI()
    frame:SetVisible(not frame:IsVisible())
    if frame:IsVisible() then
        frame:MakePopup()
    end
end

-- Örnek Bind: [Q] tuşunu kullanarak GUI'yi açma/kapama
-- Bu kısım, oyunun Keybind sistemi ile entegre edilmelidir.
-- Örn: bind "Q" "lua_run ToggleGUI()"

-- Konsola bilgilendirme
print("[GUI Creator] ${guiName} yüklendi. Komut: ToggleGUI()")
`;
    return fullCode.trim();
}

/**
 * Kullanıcıdan gelen metni alarak Lua kodu üretir.
 * @param {string} type - Eklenen öğe türü (toggle, button, slider, vs.)
 * @param {string[]} args - Komut argümanları
 * @returns {string|null} Üretilen Lua kodu satırları
 */
function createElement(type, args) {
    const name = args[0] || 'Element' + Math.random().toString(36).slice(2, 5);
    let luaCode = '';

    switch (type) {
        case 'toggle':
            // Örn: /ekle toggle Toggle1
            const defaultToggleValue = args[1] === 'true' ? 'true' : 'false';
            luaCode = `
local ${name} = vgui.Create("DCheckBoxLabel", panel)
${name}:SetText("${name} (Toggle)")
${name}:SetValue(${defaultToggleValue})
${name}.OnChange = function(self, value)
    -- print("${name} değeri: " .. tostring(value))
    -- Oyun logiğini buraya ekle
end
`;
            break;

        case 'button':
            // Örn: /ekle button Button1
            luaCode = `
local ${name} = vgui.Create("DButton", panel)
${name}:SetText("${name} (Çalıştır)")
${name}.DoClick = function()
    -- print("${name} tıklandı!")
    -- İşlevi buraya ekle
end
`;
            break;

        case 'slider':
            // Örn: /ekle slider Slider1 0 1 0.1
            const min = parseFloat(args[1] || 0);
            const max = parseFloat(args[2] || 1);
            const def = parseFloat(args[3] || 0.5);
            luaCode = `
local ${name}Label = vgui.Create("DLabel", panel)
${name}Label:SetText("${name} (${min} - ${max})")
${name}Label:SizeToContents()
local ${name} = vgui.Create("DSlider", panel)
${name}:SetMin(${min})
${name}:SetMax(${max})
${name}:SetValue(${def})
${name}.OnValueChange = function(self, value)
    -- print("${name} değeri: " .. tostring(value))
    -- Oyun logiğini buraya ekle
end
`;
            break;
            
        case 'textbox':
             // Örn: /ekle textbox TextBox1
            luaCode = `
local ${name} = vgui.Create("DTextEntry", panel)
${name}:SetPlaceholderText("${name} - Metin Girin")
${name}:SetText("")
${name}.OnChange = function(self)
    -- print("${name} değeri: " .. self:GetValue())
end
`;
            break;

        case 'colorpicker':
            // Örn: /ekle colorpicker ColorPicker1
            luaCode = `
local ${name} = vgui.Create("DColorMixer", panel)
${name}:SetText("${name}")
${name}:SetColor(Color(255, 255, 255))
${name}.OnColorChange = function(self, color)
    -- print("${name} rengi: " .. tostring(color.r) .. ", " .. tostring(color.g) .. ", " .. tostring(color.b))
    -- Renk logiğini buraya ekle
end
`;
            break;

        case 'separator':
            // Örn: /ekle separator Section2
            luaCode = `
-- ${name} Bölücü / Ayırıcı
local ${name}Separator = vgui.Create("DLabel", panel)
${name}Separator:SetText("--- ${name} ---")
${name}Separator:SizeToContents()
`;
            break;

        default:
            return null; // Tanımlanmamış öğe
    }

    // Basitleştirilmiş düzenleme (Her öğeden sonra boşluk bırakma)
    return luaCode + `\n\n    panel:AddItem(${name})\n    panel:AddItem(${name}Label or ${name}Separator)`; 
}

// =========================================================================
// TELEGRAM İŞLEYİCİLERİ
// =========================================================================

bot.start(async (ctx) => {
    await ctx.reply(
        `Merhaba ${ctx.from.first_name}! Ben Lua GUI Kod Üretici Botuyum.\n`
        + "Oyun içi menü görselinizdeki öğeleri adım adım koda çevirebiliriz.",
    );
    await ctx.reply(
        "Yeni bir GUI oluşturmak için `/basla <GUI_Adı>` komutunu kullanın.\n"
        + "Örn: `/basla Informant_WTF_Menusu`"
    );
});

// Yeni oturum başlatma
bot.command('basla', async (ctx) => {
    const args = ctx.message.text.split(/\s+/).slice(1);
    const guiName = args[0] || "YeniGUI";
    
    // Oturumu başlat
    USER_SESSIONS.set(ctx.from.id, { guiName: guiName.replace(/[^a-zA-Z0-9_]/g, '_'), elements: [] });
    
    await ctx.reply(
        `✅ Yeni GUI oluşturuldu: **${guiName}**\n\n`
        + "Şimdi GUI öğelerini eklemeye başlayın:\n\n"
        + "`/ekle toggle Toggle1`\n"
        + "`/ekle button Button1`\n"
        + "`/ekle slider IslemHizi 0 10 5`\n"
        + "`/ekle textbox KullaniciAdi`\n"
        + "`/ekle separator Section2`\n\n"
        + "İşiniz bittiğinde `/bitir` yazın.",
        { parse_mode: 'Markdown' }
    );
});

// Öğe ekleme
bot.command('ekle', async (ctx) => {
    const sessionId = ctx.from.id;
    const session = USER_SESSIONS.get(sessionId);
    
    if (!session) {
        return ctx.reply("Önce `/basla <GUI_Adı>` komutuyla bir proje başlatın.");
    }
    
    const args = ctx.message.text.split(/\s+/).slice(1);
    const elementType = args[0] ? args[0].toLowerCase() : null;
    const elementArgs = args.slice(1);

    if (!elementType) {
        return ctx.reply("Lütfen eklenecek öğe türünü belirtin. Örn: `/ekle toggle Toggle1`");
    }

    const luaCode = createElement(elementType, elementArgs);
    
    if (luaCode) {
        session.elements.push(luaCode);
        USER_SESSIONS.set(sessionId, session);
        await ctx.reply(`➕ Öğe eklendi: **${elementType.toUpperCase()}** (${elementArgs[0] || 'İsimsiz'}).\n`
                        + `Şu an GUI'de **${session.elements.length}** öğe var.`,
                        { parse_mode: 'Markdown' });
    } else {
        await ctx.reply(`Bilinmeyen öğe türü: \`${elementType}\`. Desteklenenler: toggle, button, slider, textbox, colorpicker, separator.`);
    }
});

// Kodu bitirme ve gönderme
bot.command('bitir', async (ctx) => {
    const sessionId = ctx.from.id;
    const session = USER_SESSIONS.get(sessionId);

    if (!session) {
        return ctx.reply("Önce `/basla <GUI_Adı>` komutuyla bir proje başlatın.");
    }

    if (session.elements.length === 0) {
        return ctx.reply("GUI'ye hiç öğe eklenmedi. `/ekle` komutuyla öğe ekleyin.");
    }

    await ctx.reply("⚙️ Lua kodu oluşturuluyor...");

    try {
        const luaCode = generateLuaCode(session);
        const fileName = `${session.guiName.toLowerCase()}_gui.lua`;
        
        // Telegram'a dosya olarak gönder
        await ctx.telegram.sendDocument(ctx.chat.id, { 
            source: Buffer.from(luaCode, 'utf8'), 
            filename: fileName 
        });

        await ctx.reply(
            `✅ Kod başarıyla oluşturuldu ve **${fileName}** adıyla gönderildi.\n\n`
            + "Yeni bir GUI oluşturmak için tekrar `/basla` komutunu kullanın."
        );
        
        // Oturumu temizle
        USER_SESSIONS.delete(sessionId);

    } catch (error) {
        console.error("Kod oluşturma hatası:", error);
        await ctx.reply("Hata oluştu. Lütfen tekrar deneyin.");
    }
});


bot.launch().then(() => {
    console.log("🚀 Lua GUI Creator Botu çalışıyor!");
});

// Bot durdurma mekanizmaları
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

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

