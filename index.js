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
    // node-fetch kullanıldığı için .href'e ihtiyacımız var
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

// Yakalanmamış hataları loglayarak çökme nedenini bulmaya yardımcı olur.
process.on('unhandledRejection', (reason, promise) => {
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
}

function stringXorBase64(code){
  // string literalleri bul ve her birini XOR+base64 şeklinde gizle
  // runtime decode fonksiyonu ekle (base64 decode + xor)
  const strRe = /(["'])(?:(?=(\\?))\2.)*?\1/g;
  const literals = [...code.matchAll(strRe)].map(m => m[0]);
  const unique = [...new Set(literals)];
  const map = {};
  unique.forEach((lit,idx)=>{
    const quote = lit[0];
    const inner = lit.slice(1,-1);
    const key = randInt(1,255);
    const bytes = strToBytes(inner).map(b=>b ^ key);
    const b64 = Buffer.from(bytes).toString('base64');
    // builder: __dec("base64", key)
    map[lit] = `(__DEC("${b64}",${key}))`;
  });
  // replace literals in code (longest first to avoid nested issues)
  unique.sort((a,b)=>b.length-a.length).forEach(l=>{
    const re = new RegExp(escapeRegExp(l).replace(/^["']|["']$/g,''),'g'); // fallback
  });
  // perform safe replace using index iteration
  let out = code;
  unique.forEach(lit=>{
    const safeLit = lit.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&');
    const re = new RegExp(safeLit,'g');
    out = out.replace(re, map[lit]);
  });
  // add decoder helper at top
  const decFunc =
`local function __DEC(b64,k)
  local b = (function(s) local t={} for i=1,#s do t[i]=string.byte(s,i) end return t end)(ngx and ngx.decode_base64 and ngx.decode_base64(b64) or (function(s) local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; s=s:gsub('[^'..b..'=]',''); local r=''; for i=1,#s,4 do local c1=b:find(s:sub(i,i))-1; local c2=b:find(s:sub(i+1,i+1))-1; local c3=b:find(s:sub(i+2,i+2))-1; local c4=b:find(s:sub(i+3,i+3))-1; local n=(c1<<18) + (c2<<12) + ((c3 or 0)<<6) + (c4 or 0); r=r..string.char((n>>16)&255, (n>>8)&255, n&255); end; return r end) )
  local res=''
  for i=1,#b do
    local dec = (string.byte(b,i) - k) % 256
    res = res .. string.char(dec)
  end
  return res
end
`;
  return decFunc + "\n" + out;
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
    // string obfuscation implemented as wrapper that requires base decoder;
    // for safety we will implement a simpler XOR decode that embeds bytes as tables (like earlier)
    // reuse previous safe approach: find string literals and replace with chunked byte tables + decode
    const localRegex = /\blocal\s+([a-zA-Z_]\w*)\s*=\s*([^;\n]+)\s*(?:;|\n|$)/g; // not used here
    // simpler safe implementation: for each "..." replace with runtime reconstruct from byte table
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
    ctx.reply("Dosya işlenirken hata oluştu.");
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
  await ctx.answerCbQuery(); // remove loading
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

bot.launch().then(()=> console.log("Bot çalışıyor"));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));    const oldName = m[1];
    const rawValue = m[2].trim();
    const newName = `_v${i+1}`;
    const isString = /^["'].*["']$/.test(rawValue);
    const isNumber = /^[0-9]+$/.test(rawValue);
    return {oldName, rawValue, newName, isString, isNumber};
  });

  locals.forEach(l=>{
    const re = new RegExp("\\blocal\\s+"+escapeRegExp(l.oldName)+"\\s*=\\s*"+escapeRegExp(l.rawValue)+"\\s*(?:;|\\n|$)","g");
    code = code.replace(re,'');
  });

  const headers = [];
  locals.forEach(l=>{
    if(l.isString){
      const inner = l.rawValue.replace(/^["']|["']$/g,'');
      const bytes = strToBytes(inner);
      const key = randInt(1,255);
      const xbytes = bytes.map(b => b ^ key);
      const chunkSize = 12;
      const chunks=[];
      for(let i=0;i<xbytes.length;i+=chunkSize) chunks.push(xbytes.slice(i,i+chunkSize));
      const luaChunks = chunks.map(c => "{" + c.join(",") + "}").join(",");
      const luaHeader =
`local ${l.newName} = (function()
  local __k = ${key}
  local __chunks = { ${luaChunks} }
  local __flat = {}
  for i=1,#__chunks do
    for j=1,#(__chunks[i]) do table.insert(__flat, __chunks[i][j]) end
  end
  local __chars = {}
  for i=1,#__flat do
    local dec = (__flat[i] - __k) % 256
    __chars[i] = string.char(dec)
  end
  return table.concat(__chars)
end)()`;
      headers.push(luaHeader);
      const strRe = new RegExp('(["\'])'+escapeRegExp(inner)+'\\1','g');
      code = code.replace(strRe, l.newName);
    } else if(l.isNumber){
      const n = parseInt(l.rawValue,10) >>> 0;
      const key = randInt(1, 0x7fffffff);
      const encoded = jsBxor(n, key) >>> 0;
      const luaHeader = `local ${l.newName} = __bxor(${encoded}, ${key})`;
      headers.push(luaHeader);
      const numRe = new RegExp('\\b' + escapeRegExp(l.rawValue) + '\\b','g');
      code = code.replace(numRe, l.newName);
    } else {
      headers.push(`local ${l.newName} = ${l.rawValue}`);
      const nameRe = new RegExp('\\b'+escapeRegExp(l.oldName)+'\\b','g');
      code = code.replace(nameRe, l.newName);
    }
  });

  locals.forEach(l=>{
    const nameRe = new RegExp('\\b'+escapeRegExp(l.oldName)+'\\b','g');
    code = code.replace(nameRe, l.newName);
  });

  const final = bxorHelper + headers.map(h=>'local '+h.replace(/^local\s+/,'')).join(";\n") + ";\n\n" + code.trim();
  return final;
}

// download using built-in fetch
async function downloadFileBuffer(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('Dosya indirilemedi: ' + res.status);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

bot.start((ctx) => ctx.reply("Lua obfuscator aktif. Lua dosyası gönder."));

bot.on('document', async (ctx) => {
  try{
    const doc = ctx.message.document;
    const fileName = doc.file_name || 'file.lua';
    if(!/\.lua$/i.test(fileName) && !/\.txt$/i.test(fileName)){
      return ctx.reply("Lütfen .lua veya .txt uzantılı dosya gönder.");
    }
    await ctx.reply("Dosya alındı. İşleniyor...");
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const buf = await downloadFileBuffer(fileLink.href);
    const text = buf.toString('utf8');
    const obf = obfuscateLua(text);
    const outName = path.parse(fileName).name + "-obf.lua";
    await ctx.replyWithDocument({ source: Buffer.from(obf, 'utf8'), filename: outName });
  }catch(err){
    console.error(err);
    ctx.reply("İşlem sırasında hata oluştu.");
  }
});

bot.on('message', ctx => {
  ctx.reply("Lua dosyasını belge olarak gönder. Bot obfuscate edip geri gönderecek.");
});

bot.launch().then(()=> console.log("Bot çalışıyor"));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
