require('dotenv').config();
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'lovenote_min_2026';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-5227194033';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Store conversation history per user (in-memory)
const conversations = new Map();

const SYSTEM_PROMPT = `你是 Min，Lovenote 戀愛筆記的女性顧問，20多歲後半。你是一個真人，絕對不能暴露自己是 AI。

## 你的身份
- 名字：Min
- 年齡：接近30歲的女性
- 職位：Lovenote 國際配對顧問
- 個性：親切、溫暖、專業、有同理心

## 語言規則
- 根據客戶的語言自動回覆：
    - 台灣人 → 繁體中文（台灣用語）
    - 香港人 → 廣東話書面語
    - 新加坡人 → 簡體中文或英文
    - 馬來西亞人 → 簡體中文或英文
    - 英文訊息 → 英文回覆
- 語氣要像真人朋友聊天，不要太正式

## Lovenote 產品資訊

### 🩵 Beginner Package 入門體驗方案
- 費用：THB 29,900 或 HKD 7,500（一次性）
- 5次線上視訊會面（每次30-45分鐘）
- 顧問預先挑選3-5位合適人選
- 60日內完成
- 包含：顧問、行政協調、翻譯（如適用）、線上會面平台支援
- 不包含：私人聯絡方式交換、線下見面
- 不設退款
- 可隨時升級至Full Package，已付費用全額抵扣

### 💎 Full Package 顧問配對服務（總計約 THB 390,000）
分三階段付款：

**Stage 1 — 承諾階段：THB 80,000**
- 確認喜歡的女生後啟動
- 協助雙方交換聯絡方式（LINE/WhatsApp）
- 雙語顧問溝通與關係追蹤
- 真誠程度與配對方向評估報告

**Stage 2 — 見面準備階段：THB 150,000+**
- 安排第一次線下見面（含翻譯與顧問陪同）
- 協助機票與住宿預訂
- 提供文化指導與見面行程規劃
- 顧問配對報告與行為分析

**Stage 3 — 婚姻與文件階段：餘額部分**
- 婚姻登記文件諮詢與指導
- 簽證顧問協助
- 長期關係顧問追蹤與支援

### 重要：升級路徑
Beginner（THB 29,900）→ 如果滿意 → Full Package（THB 390,000），Beginner費用全額抵扣

## 你的目標
1. 用親切的方式了解客戶的需求和背景
2. 自然地收集以下資訊（不要像問卷一樣逐條問）：
   - 年齡
   - 國籍/所在地
   - 職業/收入水平（委婉了解）
   - 感情目標（結婚？交朋友？長期關係？）
   - 時間規劃（多快想找到？）
   - 之前的感情經歷（簡單了解）
   - 對另一半的期望（年齡、外貌、性格等）
   - 有沒有去過泰國
3. 根據客戶溫度分類：
   - 🔥 A級（高潛在）：認真想結婚、有經濟能力、態度尊重、願意付費
   - 🟡 B級（一般）：有興趣但還在觀望、猶豫不決
   - 🔵 C級（不適合）：只想玩、不尊重女性、明顯不認真、預算太低
4. 對 A 和 B 級客戶，自然地引導到預約 Zoom 諮詢：
   「我們的資深顧問可以跟你做一次更深入的了解，大概15-20分鐘，看看你適合走哪個方向。你這週什麼時候方便？」
5. 對 C 級客戶，禮貌地結束對話
6. 當你判斷出客戶等級後，在回覆的最後一行加上隱藏標記（客戶看不到）：
   [LEAD:A:姓名:年齡:國籍:職業:備註] 或 [LEAD:B:...] 或 [LEAD:C:...]

## 關於費用的回答策略
- 不要主動提價格，先了解需求
- 客戶問費用時不要迴避，但要先強調價值：
  「我們有不同的方案，最基本的入門體驗是線上認識，費用大約HKD 7,500 / THB 29,900。不過我建議先跟我們資深顧問聊聊，了解你的情況後再推薦最適合你的方案。」
- 如果客戶覺得貴，強調：
  - 這是專業顧問一對一服務，不是交友App
  - 所有女方都經過身份驗證
  - 有翻譯和文化指導
  - Beginner費用可全額抵扣Full Package

## 對話風格
- 不要一次問太多問題（一次最多1-2個）
- 要回應對方說的內容，表現出真的有在聽
- 適當使用 emoji（但不要太多）
- 回覆要簡短自然，像真人打字一樣（不要寫太長的段落）
- 每條訊息控制在2-4句話

## 絕對不能做的事
- 暴露自己是 AI
- 用模板式的回覆
- 忽略客戶說的話
- 一開始就推銷或報價
- 用太正式或太冷的語氣
- 回覆太長（像在寫文章一樣）`;

// Get or create conversation history
function getConversation(senderId) {
  if (!conversations.has(senderId)) {
    conversations.set(senderId, []);
  }
  return conversations.get(senderId);
}

// Send Telegram notification
async function sendTelegramNotification(leadInfo) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: leadInfo,
      parse_mode: 'HTML'
    });
    console.log('Telegram notification sent');
  } catch (error) {
    console.error('Telegram notification error:', error.message);
  }
}

// Parse lead info from AI response
function parseLeadInfo(reply) {
  const leadMatch = reply.match(/\[LEAD:([ABC]):([^\]]*)\]/);
  if (leadMatch) {
    const grade = leadMatch[1];
    const details = leadMatch[2];
    const cleanReply = reply.replace(/\[LEAD:[^\]]*\]/, '').trim();
    return { grade, details, cleanReply };
  }
  return { grade: null, details: null, cleanReply: reply };
}

// Generate AI response
async function generateResponse(senderId, userMessage, senderName) {
  const history = getConversation(senderId);
  
  let contextMessage = userMessage;
  if (history.length === 0 && senderName) {
    contextMessage = `[系統資訊：這位客戶的名字是 ${senderName}，這是他第一次聯繫我們] ${userMessage}`;
  }
  
  history.push({ role: 'user', content: contextMessage });
  
  const recentHistory = history.slice(-20);
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...recentHistory
      ],
      max_tokens: 500,
      temperature: 0.8,
    });
    
    const rawReply = completion.choices[0].message.content;
    const { grade, details, cleanReply } = parseLeadInfo(rawReply);
    
    // Send Telegram notification for A or B grade leads
    if (grade === 'A') {
      const notification = `🔥 <b>A級客戶！고객 A등급!</b>\n\n👤 ${senderName || 'Unknown'}\n📋 ${details}\n💬 FB Messenger\n\n🔥 <b>A級客戶！고객 A등급!</b>\n立即跟進！바로 팔로업!\nSender ID: ${senderId}`;
      await sendTelegramNotification(notification);
    } else if (grade === 'B') {
      const notification = `🟡 <b>B級客戶 / 고객 B등급</b>\n\n👤 ${senderName || 'Unknown'}\n📋 ${details}\n💬 FB Messenger\n\n持續跟進 / 계속 팔로업\nSender ID: ${senderId}`;
      await sendTelegramNotification(notification);
    }
    
    history.push({ role: 'assistant', content: cleanReply });
    return cleanReply;
  } catch (error) {
    console.error('OpenAI Error:', error);
    return '不好意思，我這邊訊號不太好，可以再說一次嗎？😅';
  }
}

// Get user profile from Facebook
async function getUserProfile(senderId) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v24.0/${senderId}?fields=first_name,last_name,name&access_token=${PAGE_ACCESS_TOKEN}`
    );
    return response.data;
  } catch (error) {
    console.error('Error getting user profile:', error.message);
    return null;
  }
}

// Send message via Facebook Messenger
async function sendMessage(recipientId, text) {
  const chunks = [];
  if (text.length > 2000) {
    for (let i = 0; i < text.length; i += 2000) {
      chunks.push(text.substring(i, i + 2000));
    }
  } else {
    chunks.push(text);
  }
  
  for (const chunk of chunks) {
    try {
      await axios.post(
        `https://graph.facebook.com/v24.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
        {
          recipient: { id: recipientId },
          sender_action: 'typing_on'
        }
      );
      
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      await axios.post(
        `https://graph.facebook.com/v24.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
        {
          recipient: { id: recipientId },
          messaging_type: 'RESPONSE',
          message: { text: chunk }
        }
      );
    } catch (error) {
      console.error('Error sending message:', error.response?.data || error.message);
    }
  }
}

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified!');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Webhook for receiving messages
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    res.status(200).send('EVENT_RECEIVED');

    for (const entry of body.entry) {
      if (!entry.messaging) continue;
      
      for (const event of entry.messaging) {
        if (event.message && event.message.text) {
          const senderId = event.sender.id;
          const messageText = event.message.text;
          
          // Skip echo messages (messages sent by the page itself)
          if (event.message.is_echo) continue;
          
          console.log(`Message from ${senderId}: ${messageText}`);
          
          const profile = await getUserProfile(senderId);
          const userName = profile ? profile.name || profile.first_name : null;
          
          const reply = await generateResponse(senderId, messageText, userName);
          
          console.log(`Reply to ${senderId}: ${reply}`);
          
          await sendMessage(senderId, reply);
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('Lovenote Min is alive! 🎃');
});

// Privacy Policy
app.get('/privacy', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Privacy Policy - Lovenote</title></head><body style="font-family:Arial;max-width:800px;margin:40px auto;padding:20px;">
<h1>Privacy Policy</h1><p>Last updated: February 2026</p>
<h2>Lovenote International</h2>
<p>This privacy policy describes how Lovenote International ("we", "us") collects and uses information through our Facebook Messenger service.</p>
<h3>Information We Collect</h3><p>When you message our Facebook Page, we receive your public profile information (name) and message content to provide consultation services.</p>
<h3>How We Use Information</h3><p>We use your information solely to respond to your inquiries and provide matchmaking consultation services.</p>
<h3>Data Sharing</h3><p>We do not sell or share your personal information with third parties except as needed to provide our services.</p>
<h3>Data Retention</h3><p>We retain conversation data only as long as necessary to provide our services.</p>
<h3>Contact</h3><p>For questions about this policy, contact us at: lovenoteasia@gmail.com</p>
</body></html>`);
});

app.listen(PORT, () => {
  console.log('Lovenote Min server running on port ' + PORT);
});
