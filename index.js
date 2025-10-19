// index.js
// npm: telegraf axios
import fs from "fs";
import path from "path";
import axios from "axios";
import { Telegraf } from "telegraf";

// BOT_TOKEN direkt kodda
const BOT_TOKEN = "8350124542:AAHwsh0LksJAZOW-hHTY1BTu5i8-XKGFn18";

if (!BOT_TOKEN) throw new Error("BOT_TOKEN yok");

const bot = new Telegraf(BOT_TOKEN);

function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function strToBytes(s){ const a=[]; for(let i=0;i<s.length;i++) a.push(s.charCodeAt(i)); return a; }
function jsBxor(a,b){ return (a ^ b) >>> 0; }

function obfuscateLua(code){
  const localRegex = /\blocal\s+([a-zA-Z_]\w*)\s*=\s*([^;\n]+)\s*(?:;|\n|$)/g;
  const matches = [...code.matchAll(localRegex)];
  const bxorHelper = `-- xor helper
local function __bxor(a,b)
  local res = 0
  local bit = 1
  while a>0 or b>0 do
    local da = a % 2
    local db = b % 2
    if (da + db) % 2 == 1 then res = res + bit end
    a = math.floor(a/2)
    b = math.floor(b/2)
    bit = bit * 2
  end
  return res
end
`;
  if(matches.length===0) return "-- no locals found\n" + code;
  const locals = matches.map((m,i)=> {
    const oldName = m[1];
    const rawValue = m[2].trim();
    const newName = `_v${i+1}`;
    const isString = /^["'].*["']$/.test(rawValue);
    const isNumber = /^[0-9]+$/.test(rawValue);
    return {oldName, rawValue, newName, isString, isNumber};
  });

  // remove original local lines
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

async function downloadFile(url){
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
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
    const buf = await downloadFile(fileLink.href);
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
