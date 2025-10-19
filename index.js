import { Telegraf } from "telegraf";

// BOT_TOKEN direkt kodda
const BOT_TOKEN = "8350124542:AAHwsh0LksJAZOW-hHTY1BTu5i8-XKGFn18";

if (!BOT_TOKEN) throw new Error("BOT_TOKEN yok");

const bot = new Telegraf(BOT_TOKEN);

// Mesaj handler
bot.on("text", ctx => {
  const text = ctx.message.text.toLowerCase();
  if (text === "sa") ctx.reply("as"); // sa -> as
  else ctx.reply(ctx.message.text);   // echo
});

bot.launch();
console.log("Bot Railway üzerinde çalışıyor...");
