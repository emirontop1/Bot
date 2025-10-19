// index.js (Görsel Analizi Simülasyonu)
import { Telegraf } from "telegraf";
// node-fetch, Node.js v18 altındaki ortamlarda fetch API'sini sağlamak için eklendi.
import fetch from "node-fetch"; 

// GÜNCELLE: Kendi bot token'ınızla DEĞİŞTİRİN
const BOT_TOKEN = "8350124542:AAHwsh0LksJAZOW-hHTY1BTu5i8-XKGFn18";
if (!BOT_TOKEN || BOT_TOKEN === "BURAYA_KENDİ_BOT_TOKENINIZI_YAZIN") {
    console.error("HATA: BOT_TOKEN tanımlanmadı. Lütfen index.js dosyasını güncelleyin.");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// =========================================================================
// LUA KOD ÜRETİCİSİ (Önceki koddan)
// =========================================================================

function generateLuaCode(session) {
    // ... [Önceki generateLuaCode fonksiyonunun içeriği aynı kalır] ...
    const guiName = session.guiName || "GeneratedGUI";
    const elementsCode = session.elements.join('\n\n    ');

    const fullCode = `
-- Lua GUI Kodu: ${guiName}
-- Bu kod, Telegram botu tarafından bir görselden analiz edilerek üretilmiştir.
-- Framework: GMod VGUI stili.

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

    -- VGUI elemanlarının düzenini ayarlama (Stacker kullanarak)
    local stacker = vgui.Create("DVBoxLayout", panel)
    stacker:Dock(FILL)
    
    -- VGUI elemanları buraya eklenir
    ${elementsCode}

    -- Tüm elemanları stacker içine taşı
    for k, v in ipairs(panel:GetChildren()) do
        stacker:Add(v)
    end
end

-- Örnek Bind
print("[GUI Creator] ${guiName} yüklemeye hazır. Komut: ToggleGUI()")
concommand.Add("toggle_${guiName.toLowerCase()}", ToggleGUI)
`;
    return fullCode.trim();
}

/**
 * Görseldeki öğeleri simüle eden ve Lua kodu üreten fonksiyon.
 * NOT: Bu fonksiyon, gönderdiğiniz GUI görselindeki öğeleri taklit eder.
 */
function simulateImageAnalysisAndCreateElements() {
    console.log("Görsel analizi simüle ediliyor...");
    
    // Sizin gönderdiğiniz GUI görselindeki öğelerin yapılandırılmış listesi:
    const structure = [
        { type: 'separator', name: 'Section1' },
        { type: 'toggle', name: 'Toggle1', default: false },
        { type: 'button', name: 'Button1' },
        { type: 'separator', name: 'Separator' },
        { type: 'slider', name: 'Slider_Value', min: 0, max: 1, default: 0.1, label: "Slider: 0.1" },
        { type: 'keybind', name: 'Keybind_Q', label: "Keybind [Q]" },
        { type: 'list', name: 'List_1', items: 1 },
        { type: 'textbox', name: 'TextBox1', placeholder: "PlaceHolder1" },
        { type: 'textbox', name: 'Text1', placeholder: "Text1" },
        { type: 'colorpicker', name: 'ColorPicker1' },
        { type: 'separator', name: 'Section2' },
    ];
    
    const elements = [];
    
    // Her öğeyi döngüye al ve Lua kodu üret
    structure.forEach(item => {
        // Bu kısım, önceki 'createElement' mantığının basitleştirilmiş bir versiyonudur.
        const name = item.name.replace(/[^a-zA-Z0-9_]/g, '') + "_vgui";
        const elementName = item.name;
        const elementContainer = name;

        let luaCode = '';
        
        switch (item.type) {
            case 'toggle':
                luaCode = `
    local ${elementContainer} = vgui.Create("DCheckBoxLabel", panel)
    ${elementContainer}:SetText("${elementName}")
    ${elementContainer}:SetValue(${item.default ? 'true' : 'false'})
    ${elementContainer}:SetTall(25); ${elementContainer}:Dock(TOP);
    ${elementContainer}.OnChange = function(self, value) end`;
                break;

            case 'button':
                luaCode = `
    local ${elementContainer} = vgui.Create("DButton", panel)
    ${elementContainer}:SetText("${elementName}")
    ${elementContainer}:SetTall(30); ${elementContainer}:Dock(TOP);
    ${elementContainer}.DoClick = function() end`;
                break;

            case 'slider':
                luaCode = `
    local ${elementContainer} = vgui.Create("DSlider", panel)
    ${elementContainer}:SetText("${item.label}")
    ${elementContainer}:SetMin(${item.min}); ${elementContainer}:SetMax(${item.max});
    ${elementContainer}:SetValue(${item.default});
    ${elementContainer}:SetTall(35); ${elementContainer}:Dock(TOP);
    ${elementContainer}.OnValueChange = function(self, value) end`;
                break;
                
            case 'textbox':
                luaCode = `
    local ${elementContainer} = vgui.Create("DTextEntry", panel)
    ${elementContainer}:SetPlaceholderText("${item.placeholder || elementName}")
    ${elementContainer}:SetTall(30); ${elementContainer}:Dock(TOP);
    ${elementContainer}.OnChange = function(self) end`;
                break;
            
            case 'colorpicker':
                luaCode = `
    local ${elementContainer} = vgui.Create("DColorMixer", panel)
    ${elementContainer}:SetText("${elementName}")
    ${elementContainer}:SetTall(150); ${elementContainer}:Dock(TOP);
    ${elementContainer}:SetColor(Color(255, 255, 255));
    ${elementContainer}.OnColorChange = function(self, color) end`;
                break;

            case 'separator':
                luaCode = `
    local ${elementContainer} = vgui.Create("DLabel", panel)
    ${elementContainer}:SetText("--- ${elementName} ---")
    ${elementContainer}:SetFont("DermaLarge"); ${elementContainer}:SetTextColor(Color(255, 150, 0));
    ${elementContainer}:SetTall(30); ${elementContainer}:Dock(TOP);`;
                break;
            
            case 'list': // Özel listbox/combobox simülasyonu
                luaCode = `
    local ${elementContainer} = vgui.Create("DComboBox", panel)
    ${elementContainer}:SetText("${elementName}")
    ${elementContainer}:AddChoice("Seçenek 1")
    ${elementContainer}:AddChoice("Seçenek 2")
    ${elementContainer}:SetTall(30); ${elementContainer}:Dock(TOP);
    ${elementContainer}.OnSelect = function(self, index, value) end`;
                break;

            case 'keybind':
                // Keybinds genellikle farklı bir VGUI öğesi veya özel bir düğmedir.
                luaCode = `
    local ${elementContainer} = vgui.Create("DButton", panel)
    ${elementContainer}:SetText("${item.label}")
    ${elementContainer}:SetTall(30); ${elementContainer}:Dock(TOP);
    ${elementContainer}.DoClick = function() 
        -- Keybind ayarlama mantığını buraya ekle (Oyun API'si gerektirir)
        print("Keybind butonu tıklandı.")
    end`;
                break;
        }
        
        if (luaCode) {
             elements.push(luaCode.trim());
        }
    });

    return { guiName: "Informant_WTF_GUI", elements };
}

// =========================================================================
// TELEGRAM İŞLEYİCİLERİ
// =========================================================================

bot.start(async (ctx) => {
    await ctx.reply(
        `Merhaba ${ctx.from.first_name}! Ben GÖRSELİ-KODA Çeviren Lua GUI Botu.\n\n`
        + "Lütfen **Lua GUI menünüzün bir görselini** gönderin. "
        + "Bot, görselinizi analiz ettiğini **simüle edecek** ve size Lua kodunu atacaktır."
    );
});

// Kullanıcı bir fotoğraf (image) veya belge (document) gönderdiğinde tetiklenir
bot.on(['photo', 'document'], async (ctx) => {
    // Sadece fotoğraf dosyalarını işler
    const fileId = ctx.message.photo 
        ? ctx.message.photo[ctx.message.photo.length - 1].file_id // En büyük fotoğrafı al
        : ctx.message.document && ctx.message.document.mime_type.startsWith('image') 
        ? ctx.message.document.file_id 
        : null;

    if (!fileId) {
        return ctx.reply("Lütfen bir görsel veya resim içeren bir belge gönderin.");
    }
    
    await ctx.reply("🔍 Görsel alındı. Yapısal analizi **simüle ediyorum**...");
    await ctx.reply("Analiz tamamlandı. Kod oluşturuluyor...");

    try {
        // 1. ADIM: Görseli Analiz Et ve Yapıyı Çıkar (Simülasyon)
        const session = simulateImageAnalysisAndCreateElements();

        // 2. ADIM: Lua Kodu Üret
        const luaCode = generateLuaCode(session);
        const fileName = `${session.guiName.toLowerCase()}_analiz_gui.lua`;
        
        // 3. ADIM: Dosyayı Gönder
        await ctx.telegram.sendDocument(ctx.chat.id, { 
            source: Buffer.from(luaCode, 'utf8'), 
            filename: fileName 
        });

        await ctx.reply(
            `✅ Görseldeki öğeler başarıyla koda çevrildi ve **${fileName}** adıyla gönderildi.\n\n`
            + "Bu kod, gönderdiğiniz GUI'nin temel öğelerini (Slider, Toggle, Button) içermektedir."
        );

    } catch (error) {
        console.error("Görsel işleme/kod oluşturma hatası:", error);
        await ctx.reply("Hata oluştu. Kod oluşturulamadı.");
    }
});

bot.on('text', ctx => {
    // Sadece text komutları hariç, tüm metinleri yoksay
    if (!ctx.message.text.startsWith('/')) {
        ctx.reply("Lütfen menü görselinizi gönderin veya `/start` yazın.");
    }
});


bot.launch().then(() => {
    console.log("🚀 Lua GUI Creator Botu (Görsel Simülasyonlu) çalışıyor!");
});

// Bot durdurma mekanizmaları
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
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

    -- VGUI elemanlarının düzenini ayarlama (Stacker kullanarak basitleştirildi)
    local stacker = vgui.Create("DVBoxLayout", panel)
    stacker:Dock(FILL)
    
    -- VGUI elemanları buraya eklenir
    ${elementsCode}

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
