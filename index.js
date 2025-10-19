// index.js
import { Telegraf } from "telegraf";

// GÜNCELLE: Kendi bot token'ınızla DEĞİŞTİRİN
const BOT_TOKEN = "8350124542:AAHwsh0LksJAZOW-hHTY1BTu5i8-XKGFn18";
if (!BOT_TOKEN) {
    console.error("HATA: BOT_TOKEN tanımlanmadı. Lütfen index.js dosyasını güncelleyin.");
    // Token yoksa uygulamayı durdur
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Kullanıcı oturum verilerini tutmak için Map
// chatId -> { guiName: string, elements: string[] }
const USER_SESSIONS = new Map();

// =========================================================================
// LUA KOD ÜRETİCİSİ
// =========================================================================

function generateLuaCode(session) {
    const guiName = session.guiName || "GeneratedGUI";
    // Elemanlar arasına iki yeni satır ekle
    const elementsCode = session.elements.join('\n\n    ');

    const fullCode = `
-- Lua GUI Kodu: ${guiName}
-- Bu kod, popüler oyun içi Lua GUI framework'leri (Örn: GMod VGUI) temel alınarak oluşturulmuştur.

-- Eğer menü zaten açıksa kapatır, kapalıysa açar.
local function ToggleGUI()
    if IsValid(frame) and frame:IsVisible() then
        frame:Remove()
        return
    end

    local frame = vgui.Create("DFrame")
    frame:SetSize(600, 500)
    frame:SetTitle("${guiName}")
    frame:Center()
    frame:SetSizable(true)
    frame:SetDraggable(true)
    frame:ShowCloseButton(true)
    frame:MakePopup()

    -- Ana Panel (ScrollPanel)
    local panel = vgui.Create("DScrollPanel", frame)
    panel:Dock(FILL)
    panel:DockMargin(5, 30, 5, 5)

    -- VGUI elemanları buraya eklenir
    ${elementsCode}

    -- VGUI elemanlarının düzenini ayarlama (Stacker kullanarak basitleştirildi)
    local stacker = vgui.Create("DVBoxLayout", panel)
    stacker:Dock(FILL)
    
    -- Tüm elemanları stacker içine taşı
    for k, v in ipairs(panel:GetChildren()) do
        stacker:Add(v)
    end
end

-- Örnek Bind: 'Q' tuşuna basıldığında GUI'yi açma/kapama
-- Bu kısım, oyunun Keybind sistemi ile entegre edilmelidir.
-- Örn (GMod): hook.Add("Think", "ToggleGUIMenu", function() 
--     if input.IsKeyPressed(KEY_Q) then ToggleGUI() end
-- end)

-- Konsola bilgilendirme
print("[GUI Creator] ${guiName} yüklemeye hazır. Komut: ToggleGUI()")

-- Botun kullanabileceği komut
concommand.Add("toggle_${guiName.toLowerCase()}", ToggleGUI)
`;
    return fullCode.trim();
}

/**
 * Kullanıcıdan gelen metni alarak Lua kodu üretir.
 */
function createElement(type, args) {
    // Lua'da değişken isimleri harf, sayı ve alt çizgi içerebilir
    const nameRaw = args[0] ? args[0].replace(/[^a-zA-Z0-9_]/g, '') : `Element_${Math.random().toString(36).slice(2, 5)}`;
    
    // Her elemanın kendine özgü bir değişken adı olmalı
    const name = nameRaw + "_vgui"; 

    let luaCode = '';
    let elementName = nameRaw; // Lua VGUI'de metin olarak kullanılan isim
    let elementContainer = name; // VGUI objesi için kullanılan değişken adı

    switch (type) {
        case 'toggle':
            // Örn: /ekle toggle Toggle1
            const defaultToggleValue = args[1] === 'true' ? 'true' : 'false';
            luaCode = `
    local ${elementContainer} = vgui.Create("DCheckBoxLabel", panel)
    ${elementContainer}:SetText("${elementName}")
    ${elementContainer}:SetConVar("${elementName}") -- İsteğe bağlı
    ${elementContainer}:SetValue(${defaultToggleValue})
    ${elementContainer}:SetTall(25)
    ${elementContainer}:Dock(TOP)
    ${elementContainer}.OnChange = function(self, value)
        -- print("${elementName} değeri: " .. tostring(value))
    end
`;
            break;

        case 'button':
            // Örn: /ekle button Button1
            luaCode = `
    local ${elementContainer} = vgui.Create("DButton", panel)
    ${elementContainer}:SetText("${elementName} (Çalıştır)")
    ${elementContainer}:SetTall(30)
    ${elementContainer}:Dock(TOP)
    ${elementContainer}.DoClick = function()
        -- print("${elementName} tıklandı!")
        -- İşlevi buraya ekle
    end
`;
            break;

        case 'slider':
            // Örn: /ekle slider Slider1 0 10 5
            const min = parseFloat(args[1] || 0);
            const max = parseFloat(args[2] || 1);
            const def = parseFloat(args[3] || 0.5);
            luaCode = `
    local ${elementContainer} = vgui.Create("DSlider", panel)
    ${elementContainer}:SetText("${elementName}")
    ${elementContainer}:SetMin(${min})
    ${elementContainer}:SetMax(${max})
    ${elementContainer}:SetDecimals(2)
    ${elementContainer}:SetValue(${def})
    ${elementContainer}:SetTall(35)
    ${elementContainer}:Dock(TOP)
    ${elementContainer}.OnValueChange = function(self, value)
        -- print("${elementName} değeri: " .. tostring(value))
    end
`;
            break;
            
        case 'textbox':
             // Örn: /ekle textbox KullaniciAdi
            luaCode = `
    local ${elementContainer} = vgui.Create("DTextEntry", panel)
    ${elementContainer}:SetPlaceholderText("${elementName} - Metin Girin")
    ${elementContainer}:SetText("")
    ${elementContainer}:SetTall(30)
    ${elementContainer}:Dock(TOP)
    ${elementContainer}.OnChange = function(self)
        -- print("${elementName} değeri: " .. self:GetValue())
    end
`;
            break;

        case 'colorpicker':
            // Örn: /ekle colorpicker BotRenk
            luaCode = `
    local ${elementContainer} = vgui.Create("DColorMixer", panel)
    ${elementContainer}:SetText("${elementName}")
    ${elementContainer}:SetTall(150)
    ${elementContainer}:Dock(TOP)
    ${elementContainer}:SetColor(Color(255, 255, 255))
    ${elementContainer}.OnColorChange = function(self, color)
        -- print("${elementName} rengi: " .. tostring(color.r) .. ", " .. tostring(color.g) .. ", " .. tostring(color.b))
    end
`;
            break;

        case 'separator':
            // Örn: /ekle separator Section2
            luaCode = `
    -- ${elementName} Bölücü / Ayırıcı
    local ${elementContainer} = vgui.Create("DLabel", panel)
    ${elementContainer}:SetText("--- ${elementName} ---")
    ${elementContainer}:SetFont("DermaLarge")
    ${elementContainer}:SetTextColor(Color(255, 150, 0))
    ${elementContainer}:SetTall(30)
    ${elementContainer}:Dock(TOP)
`;
            break;

        default:
            return null; // Tanımlanmamış öğe
    }

    // Üretilen kodu döndür
    return luaCode; 
}

// =========================================================================
// TELEGRAM İŞLEYİCİLERİ
// =========================================================================

bot.start(async (ctx) => {
    // Bu, botun ilk komuta verdiği cevaptır.
    await ctx.reply(
        `Merhaba ${ctx.from.first_name}! Ben Lua GUI Kod Üretici Botuyum.\n`
        + "Oyun içi menü görselinizdeki öğeleri adım adım koda çevirebiliriz.",
    );
    await ctx.reply(
        "Yeni bir GUI oluşturmak için `/basla <GUI_Adı>` komutunu kullanın.\n"
        + "Örn: `/basla Informant_WTF_Menusu`",
        { parse_mode: 'Markdown' }
    );
});

// Yeni oturum başlatma
bot.command('basla', async (ctx) => {
    const args = ctx.message.text.split(/\s+/).slice(1);
    const guiName = args[0] || "YeniGUI";
    
    // Güvenli dosya/değişken adı oluştur
    const safeName = guiName.replace(/[^a-zA-Z0-9_]/g, '_');
    
    // Oturumu başlat
    USER_SESSIONS.set(ctx.from.id, { guiName: safeName, elements: [] });
    
    await ctx.reply(
        `✅ Yeni GUI projesi oluşturuldu: **${safeName}**\n\n`
        + "Şimdi GUI öğelerini eklemeye başlayın:\n"
        + "`/ekle toggle Toggle1`\n"
        + "`/ekle button Button1`\n"
        + "`/ekle slider IslemHizi 0 10 5` (Min, Max, Vars)\n"
        + "`/ekle textbox KullaniciAdi`\n"
        + "`/ekle separator Section2`\n"
        + "`/ekle colorpicker BotRenk`\n\n"
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
