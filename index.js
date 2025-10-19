// index.js
// npm install telegraf node-fetch
import fs from "fs";
import path from "path";
import { Telegraf } from "telegraf";
// node-fetch, Node.js v18 altındaki ortamlarda fetch API'sini sağlamak için eklendi.
import fetch from "node-fetch";

// BOT_TOKEN direkt kodda
const BOT_TOKEN = "8350124542:AAHwsh0LksJAZOW-hHTY1BTu5i8-XKGFn18";
if (!BOT_TOKEN) throw new Error("BOT_TOKEN yok");

const bot = new Telegraf(BOT_TOKEN);

// geçici depolama: chatId -> { filename, content }
const STORE = new Map();

/* yardımcılar */
function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function strToBytes(s){ const a=[]; for(let i=0;i<s.length;i++) a.push(s.charCodeAt(i)); return a; }

/* obfuscation parçaları */
function renameLocals(code){
  // local varlarını _x123 tarzı rassal isimlere çevir
  const localRegex = /\blocal\s+([a-zA-Z_]\w*)/g;
  const names = [...code.matchAll(localRegex)].map(m=>m[1]);
  const uniq = [...new Set(names)];
  const map = {};
  uniq.forEach((n,i)=>{
    map[n] = "_I" + Math.random().toString(36).slice(2,8) + i;
  });
  Object.keys(map).forEach(oldName=>{
    const re = new RegExp('\\b'+escapeRegExp(oldName)+'\\b','g');
    code = code.replace(re, map[oldName]);
  });
  return code;
}

function numArithmeticObfuscate(code){
  // basit: sabit tam sayıları parçalara ayır ve ifade ile değiştir
  const numRe = /\b([0-9]{2,})\b/g;
  return code.replace(numRe, (m)=>{
    const n = parseInt(m,10);
    if(isNaN(n)) return m;
    const parts = [];
    let rem = n;
    let pow = 1;
    while(rem>0){
      const digit = rem % 10;
      if(digit) parts.push(digit*pow);
      rem = Math.floor(rem/10);
      pow *= 10;
    }
    if(parts.length<=1) return m;
    // shuffle parts
    for(let i=parts.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [parts[i],parts[j]]=[parts[j],parts[i]];
    }
    return '(' + parts.join('+') + ')';
  });
}

function minifyLua(code){
  // yorum ve gereksiz boşlukları kaldır (basit)
  // remove -- comments
  code = code.replace(/--\[=*\[[\s\S]*?\]=*\]/g, ''); // long comments
  code = code.replace(/--.*$/gm, '');
  // trim lines and remove extra empty lines
  code = code.split('\n').map(l=>l.trim()).filter(l=>l.length>0).join(' ');
  return code;
}

function addJunk(code){
  // rastgele kullanılmayan fonksiyonlar ekle
  const junkCount = 2 + Math.floor(Math.random()*3);
  let junk = '';
  for(let i=0;i<junkCount;i++){
    const name = '_J' + Math.random().toString(36).slice(2,9);
    const a = randInt(1,1000), b=randInt(1,1000);
    junk += `local function ${name}() local x=${a}; local y=${b}; return (x*y + ${randInt(1,100)}) end\n`;
  }
  return junk + "\n" + code;
}

/* combined obfuscator */
function applyObfuscation(code, options){
  let out = code;
  if(options.includes('minify')) out = minifyLua(out);
  if(options.includes('rename')) out = renameLocals(out);
  if(options.includes('numbers')) out = numArithmeticObfuscate(out);
  if(options.includes('strings')) {
    // string literalleri bul ve byte tablosu + XOR decode ile gizle
    const strRe = /(["'])(?:(?=(\\?))\2.)*?\1/g;
    const lits = [...out.matchAll(strRe)].map(m=>m[0]);
    const uniq = [...new Set(lits)];
    uniq.forEach(lit=>{
      const inner = lit.slice(1,-1);
      const key = randInt(1,255);
      const bytes = strToBytes(inner).map(b=>b ^ key);
      const chunkSize = 12;
      const chunks=[];
      for(let i=0;i<bytes.length;i+=chunkSize) chunks.push(bytes.slice(i,i+chunkSize));
      const luaChunks = chunks.map(c=> '{' + c.join(',') + '}' ).join(',');
      const varName = "_S" + Math.random().toString(36).slice(2,8);
      const header =
`${varName} = (function() local __k=${key}; local __chunks={${luaChunks}}; local __t={}; for i=1,#__chunks do for j=1,#(__chunks[i]) do table.insert(__t,__chunks[i][j]) end end; local __s={}; for i=1,#__t do __s[i]=string.char((__t[i]-__k)%256) end; return table.concat(__s) end)()`;
      out = header + "\n" + out.replace(new RegExp(escapeRegExp(lit),'g'), varName);
    });
  }
  if(options.includes('junk')) out = addJunk(out);
  return out;
}

/* helper: download file using fetch */
async function downloadFileBuffer(url){
  // node-fetch kütüphanesi kullanılarak dosya indirimi
  const res = await fetch(url);
  if(!res.ok) throw new Error('Dosya indirilemedi: ' + res.status);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/* inline keyboard options */
const OPTIONS_KB = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "1️⃣ Identifier rename", callback_data: "opt_rename" }],
      [{ text: "2️⃣ String XOR+Chunks", callback_data: "opt_strings" }],
      [{ text: "3️⃣ Number -> arithmetic", callback_data: "opt_numbers" }],
      [{ text: "4️⃣ Minify (strip comments/whitespace)", callback_data: "opt_minify" }],
      [{ text: "5️⃣ Add junk code", callback_data: "opt_junk" }],
      [{ text: "✅ Hepsini uygula", callback_data: "opt_all" }],
      [{ text: "❌ İptal", callback_data: "opt_cancel" }]
    ]
  }
};

bot.start(ctx => ctx.reply("Lua obfuscator aktif. Lua dosyasını belge olarak gönder. Bot hangi teknikleri uygulamak istediğini soracak."));

bot.on('document', async (ctx) => {
  try{
    const doc = ctx.message.document;
    const fileName = doc.file_name || 'file.lua';
    if(!/\.lua$/i.test(fileName) && !/\.txt$/i.test(fileName)){
      return ctx.reply("Lütfen .lua veya .txt uzantılı dosya gönder.");
    }
    await ctx.reply("Dosya alındı. Hangi obfuscation tekniklerini uygulamak istersin?", OPTIONS_KB);
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const buf = await downloadFileBuffer(fileLink.href);
    const text = buf.toString('utf8');
    STORE.set(String(ctx.chat.id), { filename: fileName, content: text });
  }catch(err){
    console.error(err);
    ctx.reply("Dosya işlenirken hata oluştu: " + err.message);
  }
});

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const chatId = String(ctx.callbackQuery.message.chat.id);
  const stored = STORE.get(chatId);
  if(!stored){
    await ctx.answerCbQuery("Önce dosya gönder.");
    return;
  }
  await ctx.answerCbQuery(); // loading'i kaldır
  if(data === 'opt_cancel'){
    STORE.delete(chatId);
    await ctx.editMessageText("İşlem iptal edildi.");
    return;
  }
  let options = [];
  if(data === 'opt_all') options = ['minify','rename','numbers','strings','junk'];
  else {
    if(data === 'opt_rename') options.push('rename');
    if(data === 'opt_strings') options.push('strings');
    if(data === 'opt_numbers') options.push('numbers');
    if(data === 'opt_minify') options.push('minify');
    if(data === 'opt_junk') options.push('junk');
  }

  await ctx.editMessageText("Seçildi: " + options.join(', ') + "\nObfuscation uygulanıyor...");
  try{
    const obf = applyObfuscation(stored.content, options);
    const outName = path.parse(stored.filename).name + "-obf.lua";
    await ctx.telegram.sendDocument(chatId, { source: Buffer.from(obf,'utf8'), filename: outName });
    STORE.delete(chatId);
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(()=>{});
  }catch(err){
    console.error(err);
    await ctx.reply("Obfuscation sırasında hata: " + String(err));
  }
});

bot.on('message', ctx => {
  ctx.reply("Lua dosyasını belge olarak gönder. Bot hangi teknikleri uygulamak istediğini soracak.");
});

// Yakalanmamış hataları yakalamak için listener'lar
process.on('unhandledRejection', (reason) => {
    console.error('YAKALANMAMIŞ RED:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('YAKALANMAMIŞ İSTİSNA:', err.stack || err);
    // Hatalı durumda botun yeniden başlamasını tetikle
    process.exit(1);
});

bot.launch().then(()=> console.log("Bot çalışıyor"));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Dosya SONU
