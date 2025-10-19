import { Telegraf } from "telegraf";

const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET = process.env.WEBHOOK_SECRET;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN yok");

let bot = global.__telegram_bot;
if (!bot) {
  bot = new Telegraf(BOT_TOKEN);

  // Mesaj handler
  bot.on("text", ctx => {
    const text = ctx.message.text.toLowerCase();
    if (text === "sa") {
      ctx.reply("as");
    } else {
      ctx.reply(ctx.message.text); // echo
    }
  });

  global.__telegram_bot = bot;
}

export default async function handler(req, res) {
  const q = req.query?.secret || req.headers["x-webhook-secret"];
  if (q !== SECRET) return res.status(403).send("forbidden");

  if (req.method === "POST") {
    try {
      await bot.handleUpdate(req.body);
      return res.status(200).send("ok");
    } catch (err) {
      console.error(err);
      return res.status(500).send("error");
    }
  }

  res.status(200).send("sa-echo bot webhook endpoint");
}
