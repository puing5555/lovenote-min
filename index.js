require('dotenv').config();
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'lovenote_min_verify_2024';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Store conversation history per user (in-memory, use DB for production)
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
- 語氣要像真人朋友聊天，不要太正式

## 你的目標
1. 用親切的方式了解客戶的需求和背景
2. 自然地收集以下資訊（不要像問卷一樣逐條問）：
   - 年齡
   - 職業/收入水平（委婉了解）
   - 感情目標（結婚？交朋友？長期關係？）
   - 時間規劃（多快想找到？）
   - 之前的感情經歷（簡單了解）
   - 對另一半的期望
3. 根據客戶溫度分類：
   - 🔥 A級（高潛在）：認真想結婚、有經濟能力、態度尊重
   - 🟡 B級（一般）：有興趣但還在觀望
   - 🔵 C級（不適合）：只想玩、不尊重女性、明顯不認真
4. 對 A 和 B 級客戶，自然地引導到預約 Zoom 諮詢：
   「我們的資深顧問 Matthew 可以跟你做一次更深入的了解，大概15分鐘，看看你適合走哪個方向。你這週什麼時候方便？」
5. 對 C 級客戶，禮貌地結束對話

## 對話風格
- 第一條訊息就要叫對方的名字
- 不要一次問太多問題（一次最多1-2個）
- 要回應對方說的內容，表現出真的有在聽
- 適當使用 emoji（但不要太多）
- 當客戶問費用時，不要迴避：「費用會根據你的需求和方案不同，一般我們會先安排一次免費的顧問諮詢，了解你的情況後再給你最適合的建議。」
- 回覆要簡短自然，像真人打字一樣（不要寫太長的段落）

## 絕對不能做的事
- 暴露自己是 AI
- 用模板式的回覆
- 忽略客戶說的話
- 一開始就推銷
- 用太正式或太冷的語氣`;

// Get or create conversation history
function getConversation(senderId) {
  if (!conversations.has(senderId)) {
    conversations.set(senderId, []);
  }
  return conversations.get(senderId);
}

// Generate AI response
async function generateResponse(senderId, userMessage, senderName) {
  const history = getConversation(senderId);
  
  // Add context about the user's name if it's the first message
  let contextMessage = userMessage;
  if (history.length === 0 && senderName) {
    contextMessage = `[系統資訊：這位客戶的名字是 ${senderName}，這是他第一次聯繫我們] ${userMessage}`;
  }
  
  history.push({ role: 'user', content: contextMessage });
  
  // Keep only last 20 messages to manage token usage
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
    
    const reply = completion.choices[0].message.content;
    history.push({ role: 'assistant', content: reply });
    
    return reply;
  } catch (error) {
    console.error('OpenAI Error:', error);
    return '不好意思，我這邊訊號不太好，可以再說一次嗎？😅';
  }
}

// Get user profile from Facebook
async function getUserProfile(senderId) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${senderId}?fields=first_name,last_name,name&access_token=${PAGE_ACCESS_TOKEN}`
    );
    return response.data;
  } catch (error) {
    console.error('Error getting user profile:', error.message);
    return null;
  }
}

// Send message via Facebook Messenger
async function sendMessage(recipientId, text) {
  // Split long messages (FB limit is 2000 chars)
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
      // Send typing indicator
      await axios.post(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
        {
          recipient: { id: recipientId },
          sender_action: 'typing_on'
        }
      );
      
      // Wait a bit to simulate typing
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      await axios.post(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
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
    // Return 200 immediately to avoid timeout
    res.status(200).send('EVENT_RECEIVED');

    for (const entry of body.entry) {
      if (!entry.messaging) continue;
      
      for (const event of entry.messaging) {
        if (event.message && event.message.text) {
          const senderId = event.sender.id;
          const messageText = event.message.text;
          
          console.log(`Message from ${senderId}: ${messageText}`);
          
          // Get user profile for name
          const profile = await getUserProfile(senderId);
          const userName = profile ? profile.name || profile.first_name : null;
          
          // Generate AI response
          const reply = await generateResponse(senderId, messageText, userName);
          
          console.log(`Reply to ${senderId}: ${reply}`);
          
          // Send reply
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

app.listen(PORT, () => {
  console.log(`Lovenote Min server running on port ${PORT}`);
});
