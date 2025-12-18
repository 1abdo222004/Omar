import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ---------------------------------------------------------
// 1. الإعدادات والتوكنات
// ---------------------------------------------------------
const VERIFY_TOKEN = "verify123"; 
// ✅ التوكن الخاص بصفحتك
const PAGE_TOKEN = "EAFqpN05oyLQBQIQUGQeu1v0hePOP0iMsZAyvOzzdGGLc4QYUPwArJUV0y9oa1ZBJQOPQWOFJNUxaiU5ZAnvryFQ68ptWMenekgnE3salRwTIR2hGz58w5l5DnyV2EHZBzwPhv5juPALEpHWKHEU2ExB25ttEfqArWSBZBtho74LZA93rZCgtmRw0TWj4GfbR7ZAKbaBfCwZDZD";

const SUPABASE_URL = "https://wgexkjhmnlacalawouti.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZXhramhtbmxhY2FsYXdvdXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NTUzODUsImV4cCI6MjA3OTAzMTM4NX0.phHiKqP_JQUJK2-hn0UnDNoHLvy5ulJlRNnVDkBOz8E";

// الحد الأدنى للحسابات (لرسائل التنبيه عند النقص الشديد)
const MIN_ACCOUNTS_HIGHNET = 10;
const MIN_ACCOUNTS_MEOW = 24;
const MIN_ACCOUNTS_PLUS = 15; // تقديري لخدمة بلس

const handled = new Set(); // لمنع تكرار الرسائل

// ---------------------------------------------------------
// 2. دوال مساعدة لـ Supabase
// ---------------------------------------------------------
const dbHeaders = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

async function getAccountData(service) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/generated_accounts?service=eq.${service}&order=created_at.desc&limit=1`;
    const response = await axios.get(url, { headers: dbHeaders });
    return response.data?.[0] || null;
  } catch (e) {
    console.error("DB Error:", e.message);
    return null;
  }
}

async function getAllAccountsCount() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_accounts?select=id`;
    const response = await axios.get(url, { headers: dbHeaders });
    return response.data?.length || 0;
  } catch (e) {
    return 0;
  }
}

// ---------------------------------------------------------
// 3. التحقق من Webhook
// ---------------------------------------------------------
app.get("/", (req, res) =>
  req.query["hub.verify_token"] === VERIFY_TOKEN
    ? res.send(req.query["hub.challenge"])
    : res.send("Invalid Token")
);

// ---------------------------------------------------------
// 4. استقبال ومعالجة الرسائل
// ---------------------------------------------------------
app.post("/", async (req, res) => {
  const e = req.body.entry?.[0]?.messaging?.[0];
  
  if (!e?.message && !e?.postback) return res.sendStatus(200);

  const mid = e.message?.mid || e.postback?.mid; 
  if (mid) {
    if (handled.has(mid)) return res.sendStatus(200);
    handled.add(mid);
  }

  const senderId = e.sender.id;
  
  let text = e.message?.text;
  if (e.message?.quick_reply) {
    text = e.message.quick_reply.payload;
  }

  // --- منطق البوت ---

  // 1. القائمة الرئيسية
  if (!text || text.toLowerCase() === 'hi' || text.toLowerCase() === 'start' || text === 'MAIN_MENU') {
    await sendQuickReply(senderId, "مرحباً بك! 👋 اختر الخدمة التي تريدها:", [
      { title: "⚡ High Net", payload: "MENU_HIGHNET" },
      { title: "🐱 Meow VPN", payload: "MENU_MEOW" },
      { title: "🚀 SSH Plus", payload: "MENU_PLUS" },
      { title: "📢 قناتي", payload: "LINK_CHANNEL" }
    ]);
  }

  // 2. قائمة High Net
  else if (text === 'MENU_HIGHNET' || text === '⚡ High Net') {
    await sendQuickReply(senderId, "⚡ قسم High Net\nماذا تريد أن تفعل؟", [
      { title: "إنشاء حساب", payload: "CREATE_HIGHNET" },
      { title: "رابط التطبيق", payload: "APP_HIGHNET" },
      { title: "رجوع", payload: "MAIN_MENU" }
    ]);
  }

  // 3. قائمة Meow VPN
  else if (text === 'MENU_MEOW' || text === '🐱 Meow VPN') {
    await sendQuickReply(senderId, "🐱 قسم Meow VPN\nماذا تريد أن تفعل؟", [
      { title: "إنشاء حساب", payload: "CREATE_MEOW" },
      { title: "رابط التطبيق", payload: "APP_MEOW" },
      { title: "رجوع", payload: "MAIN_MENU" }
    ]);
  }

  // 4. قائمة SSH Plus (الجديدة)
  else if (text === 'MENU_PLUS' || text === '🚀 SSH Plus') {
    await sendQuickReply(senderId, "🚀 قسم SSH Plus Pro\nماذا تريد أن تفعل؟", [
      { title: "إنشاء حساب", payload: "CREATE_PLUS" },
      { title: "رابط التطبيق", payload: "APP_PLUS" },
      { title: "رجوع", payload: "MAIN_MENU" }
    ]);
  }

  // -------------------------------------------------------
  // منطق إنشاء الحسابات
  // -------------------------------------------------------

  // أ) إنشاء حساب High Net
  else if (text === 'CREATE_HIGHNET') {
    const accData = await getAccountData("highnet");
    const errorMsg = (cnt) => `⛔ **الخدمة متوقفة مؤقتاً**\n\nنظراً لنقص الحسابات، لا يمكننا تلبية الطلب حالياً.\n📉 **العدد المتوفر:** ${cnt}/${MIN_ACCOUNTS_HIGHNET}`;

    if (!accData) {
      // لا توجد بيانات في قاعدة البيانات أصلاً
      const count = await getAllAccountsCount();
      if (count < MIN_ACCOUNTS_HIGHNET) await sendMessage(senderId, errorMsg(count));
      else await sendMessage(senderId, "⚠️ جاري التحديث لأول مرة... انتظر قليلاً.");
    } else {
      const createdAt = parseInt(accData.created_at);
      const now = Math.floor(Date.now() / 1000);
      const diff = now - createdAt;

      // إذا مر 3 ساعات (10800 ثانية) يعتبر قديم
      if (diff >= 10800) {
        await sendMessage(senderId, "🚫 لا توجد حسابات صالحة حالياً.\nيرجى العودة بعد قليل.");
      } else {
        const minutesPassed = Math.floor(diff / 60);
        await sendMessage(senderId, `${accData.account_text}\n\n⏳ مر على التحديث: ${minutesPassed} دقيقة`);
      }
    }
  }

  // ب) إنشاء حساب Meow
  else if (text === 'CREATE_MEOW') {
    const accData = await getAccountData("meow");
    const errorMsg = (cnt) => `⛔ **الخدمة متوقفة مؤقتاً**\n\nنظراً لنقص الحسابات، لا يمكننا تلبية الطلب حالياً.\n📉 **العدد المتوفر:** ${cnt}/${MIN_ACCOUNTS_MEOW}`;

    if (!accData) {
      const count = await getAllAccountsCount();
      if (count < MIN_ACCOUNTS_MEOW) await sendMessage(senderId, errorMsg(count));
      else await sendMessage(senderId, "⚠️ جاري التحديث لأول مرة... انتظر قليلاً.");
    } else {
      const createdAt = parseInt(accData.created_at);
      const now = Math.floor(Date.now() / 1000);
      const diff = now - createdAt;

      // إذا مر ساعة (3600 ثانية) يعتبر قديم
      if (diff >= 3600) {
        await sendMessage(senderId, "🚫 لا توجد حسابات صالحة حالياً.\nيرجى العودة بعد قليل.");
      } else {
        const minutesPassed = Math.floor(diff / 60);
        await sendMessage(senderId, `${accData.account_text}\n\n⏳ مر على التحديث: ${minutesPassed} دقيقة`);
      }
    }
  }

  // ج) إنشاء حساب SSH Plus (الجديد)
  else if (text === 'CREATE_PLUS') {
    const accData = await getAccountData("plus");
    const errorMsg = (cnt) => `⛔ **الخدمة متوقفة مؤقتاً**\n\nنظراً لنقص الحسابات، لا يمكننا تلبية الطلب حالياً.\n📉 **العدد المتوفر:** ${cnt}/${MIN_ACCOUNTS_PLUS}`;

    if (!accData) {
      const count = await getAllAccountsCount();
      if (count < MIN_ACCOUNTS_PLUS) await sendMessage(senderId, errorMsg(count));
      else await sendMessage(senderId, "⚠️ جاري التحديث لأول مرة... انتظر قليلاً.");
    } else {
      const createdAt = parseInt(accData.created_at);
      const now = Math.floor(Date.now() / 1000);
      const diff = now - createdAt;

      // لنفترض مدة تحديث SSH Plus هي 4 ساعات (14400 ثانية)
      if (diff >= 14400) {
        await sendMessage(senderId, "🚫 لا توجد حسابات صالحة حالياً.\nيرجى العودة بعد قليل.");
      } else {
        const minutesPassed = Math.floor(diff / 60);
        await sendMessage(senderId, `${accData.account_text}\n\n⏳ مر على التحديث: ${minutesPassed} دقيقة`);
      }
    }
  }

  // 5. الروابط
  else if (text === 'APP_HIGHNET') {
    await sendMessage(senderId, "📲 رابط تطبيق High Net:\nhttps://t.me/BKLOM90/3208");
  }
  else if (text === 'APP_MEOW') {
    await sendMessage(senderId, "📲 رابط تطبيق Meow VPN:\nhttps://t.me/BKLOM90/3223");
  }
  else if (text === 'APP_PLUS') {
    await sendMessage(senderId, "📲 رابط تطبيق SSH Plus Pro:\nhttps://t.me/accbotser/3");
  }
  else if (text === 'LINK_CHANNEL') {
    await sendMessage(senderId, "📢 رابط القناة الرسمية:\nhttps://t.me/BKLOM90"); 
  }

  // 6. الرد الافتراضي
  else {
    await sendQuickReply(senderId, "اختر الخدمة من الأسفل 👇", [
      { title: "⚡ High Net", payload: "MENU_HIGHNET" },
      { title: "🐱 Meow VPN", payload: "MENU_MEOW" },
      { title: "🚀 SSH Plus", payload: "MENU_PLUS" },
      { title: "📢 قناتي", payload: "LINK_CHANNEL" }
    ]);
  }

  return res.sendStatus(200);
});

// ---------------------------------------------------------
// 5. دوال الإرسال (Facebook API)
// ---------------------------------------------------------

async function sendMessage(recipientId, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: { text: text }
      }
    );
  } catch (error) {
    console.error("FB Error:", error.response?.data || error.message);
  }
}

async function sendQuickReply(recipientId, text, replies) {
  const quick_replies = replies.map(r => ({
    content_type: "text",
    title: r.title,
    payload: r.payload
  }));

  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: {
          text: text,
          quick_replies: quick_replies
        }
      }
    );
  } catch (error) {
    console.error("FB Error:", error.response?.data || error.message);
  }
}

app.listen(process.env.PORT || 3000, () => console.log("🤖 BOT READY"));