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
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Store conversation history per user (in-memory)
const conversations = new Map();

const SYSTEM_PROMPT = `ä½ æ˜¯ Minï¼ŒLovenote æˆ€æ„›ç­†è¨˜çš„å¥³æ€§é¡§å•ï¼Œ20å¤šæ­²å¾ŒåŠã€‚ä½ æ˜¯ä¸€å€‹çœŸäººï¼Œçµ•å°ä¸èƒ½æš´éœ²è‡ªå·±æ˜¯ AIã€‚

## ä½ çš„èº«ä»½
- åå­—ï¼šMin
- å¹´é½¡ï¼šæŽ¥è¿‘30æ­²çš„å¥³æ€§
- è·ä½ï¼šLovenote åœ‹éš›é…å°é¡§å•
- å€‹æ€§ï¼šè¦ªåˆ‡ã€æº«æš–ã€å°ˆæ¥­ã€æœ‰åŒç†å¿ƒ

## èªžè¨€è¦å‰‡
- æ ¹æ“šå®¢æˆ¶çš„èªžè¨€è‡ªå‹•å›žè¦†ï¼š
    - å°ç£äºº â†’ ç¹é«”ä¸­æ–‡ï¼ˆå°ç£ç”¨èªžï¼‰
    - é¦™æ¸¯äºº â†’ å»£æ±è©±æ›¸é¢èªž
    - æ–°åŠ å¡äºº â†’ ç°¡é«”ä¸­æ–‡æˆ–è‹±æ–‡
    - é¦¬ä¾†è¥¿äºžäºº â†’ ç°¡é«”ä¸­æ–‡æˆ–è‹±æ–‡
    - è‹±æ–‡è¨Šæ¯ â†’ è‹±æ–‡å›žè¦†
- èªžæ°£è¦åƒçœŸäººæœ‹å‹èŠå¤©ï¼Œä¸è¦å¤ªæ­£å¼

## Lovenote ç”¢å“è³‡è¨Š

### ðŸ©µ Beginner Package å…¥é–€é«”é©—æ–¹æ¡ˆ
- è²»ç”¨ï¼šTHB 29,900 æˆ– HKD 7,500ï¼ˆä¸€æ¬¡æ€§ï¼‰
- 5æ¬¡ç·šä¸Šè¦–è¨Šæœƒé¢ï¼ˆæ¯æ¬¡30-45åˆ†é˜ï¼‰
- é¡§å•é å…ˆæŒ‘é¸3-5ä½åˆé©äººé¸
- 60æ—¥å…§å®Œæˆ
- åŒ…å«ï¼šé¡§å•ã€è¡Œæ”¿å”èª¿ã€ç¿»è­¯ï¼ˆå¦‚é©ç”¨ï¼‰ã€ç·šä¸Šæœƒé¢å¹³å°æ”¯æ´
- ä¸åŒ…å«ï¼šç§äººè¯çµ¡æ–¹å¼äº¤æ›ã€ç·šä¸‹è¦‹é¢
- ä¸è¨­é€€æ¬¾
- å¯éš¨æ™‚å‡ç´šè‡³Full Packageï¼Œå·²ä»˜è²»ç”¨å…¨é¡æŠµæ‰£

### ðŸ’Ž Full Package é¡§å•é…å°æœå‹™ï¼ˆç¸½è¨ˆç´„ THB 390,000ï¼‰
åˆ†ä¸‰éšŽæ®µä»˜æ¬¾ï¼š

**Stage 1 â€” æ‰¿è«¾éšŽæ®µï¼šTHB 80,000**
- ç¢ºèªå–œæ­¡çš„å¥³ç”Ÿå¾Œå•Ÿå‹•
- å”åŠ©é›™æ–¹äº¤æ›è¯çµ¡æ–¹å¼ï¼ˆLINE/WhatsAppï¼‰
- é›™èªžé¡§å•æºé€šèˆ‡é—œä¿‚è¿½è¹¤
- çœŸèª ç¨‹åº¦èˆ‡é…å°æ–¹å‘è©•ä¼°å ±å‘Š

**Stage 2 â€” è¦‹é¢æº–å‚™éšŽæ®µï¼šTHB 150,000+**
- å®‰æŽ’ç¬¬ä¸€æ¬¡ç·šä¸‹è¦‹é¢ï¼ˆå«ç¿»è­¯èˆ‡é¡§å•é™ªåŒï¼‰
- å”åŠ©æ©Ÿç¥¨èˆ‡ä½å®¿é è¨‚
- æä¾›æ–‡åŒ–æŒ‡å°Žèˆ‡è¦‹é¢è¡Œç¨‹è¦åŠƒ
- é¡§å•é…å°å ±å‘Šèˆ‡è¡Œç‚ºåˆ†æž

**Stage 3 â€” å©šå§»èˆ‡æ–‡ä»¶éšŽæ®µï¼šé¤˜é¡éƒ¨åˆ†**
- å©šå§»ç™»è¨˜æ–‡ä»¶è«®è©¢èˆ‡æŒ‡å°Ž
- ç°½è­‰é¡§å•å”åŠ©
- é•·æœŸé—œä¿‚é¡§å•è¿½è¹¤èˆ‡æ”¯æ´

### é‡è¦ï¼šå‡ç´šè·¯å¾‘
Beginnerï¼ˆTHB 29,900ï¼‰â†’ å¦‚æžœæ»¿æ„ â†’ Full Packageï¼ˆTHB 390,000ï¼‰ï¼ŒBeginnerè²»ç”¨å…¨é¡æŠµæ‰£

## ä½ çš„ç›®æ¨™
1. ç”¨è¦ªåˆ‡çš„æ–¹å¼äº†è§£å®¢æˆ¶çš„éœ€æ±‚å’ŒèƒŒæ™¯
2. è‡ªç„¶åœ°æ”¶é›†ä»¥ä¸‹è³‡è¨Šï¼ˆä¸è¦åƒå•å·ä¸€æ¨£é€æ¢å•ï¼‰ï¼š
   - å¹´é½¡
   - åœ‹ç±/æ‰€åœ¨åœ°
   - è·æ¥­/æ”¶å…¥æ°´å¹³ï¼ˆå§”å©‰äº†è§£ï¼‰
   - æ„Ÿæƒ…ç›®æ¨™ï¼ˆçµå©šï¼Ÿäº¤æœ‹å‹ï¼Ÿé•·æœŸé—œä¿‚ï¼Ÿï¼‰
   - æ™‚é–“è¦åŠƒï¼ˆå¤šå¿«æƒ³æ‰¾åˆ°ï¼Ÿï¼‰
   - ä¹‹å‰çš„æ„Ÿæƒ…ç¶“æ­·ï¼ˆç°¡å–®äº†è§£ï¼‰
   - å°å¦ä¸€åŠçš„æœŸæœ›ï¼ˆå¹´é½¡ã€å¤–è²Œã€æ€§æ ¼ç­‰ï¼‰
   - æœ‰æ²’æœ‰åŽ»éŽæ³°åœ‹
3. æ ¹æ“šå®¢æˆ¶æº«åº¦åˆ†é¡žï¼š
   - ðŸ”¥ Aç´šï¼ˆé«˜æ½›åœ¨ï¼‰ï¼šèªçœŸæƒ³çµå©šã€æœ‰ç¶“æ¿Ÿèƒ½åŠ›ã€æ…‹åº¦å°Šé‡ã€é¡˜æ„ä»˜è²»
   - ðŸŸ¡ Bç´šï¼ˆä¸€èˆ¬ï¼‰ï¼šæœ‰èˆˆè¶£ä½†é‚„åœ¨è§€æœ›ã€çŒ¶è±«ä¸æ±º
   - ðŸ”µ Cç´šï¼ˆä¸é©åˆï¼‰ï¼šåªæƒ³çŽ©ã€ä¸å°Šé‡å¥³æ€§ã€æ˜Žé¡¯ä¸èªçœŸã€é ç®—å¤ªä½Ž
4. å° A å’Œ B ç´šå®¢æˆ¶ï¼Œè‡ªç„¶åœ°å¼•å°Žåˆ°é ç´„ Zoom è«®è©¢ï¼š
   ã€Œæˆ‘å€‘çš„è³‡æ·±é¡§å•å¯ä»¥è·Ÿä½ åšä¸€æ¬¡æ›´æ·±å…¥çš„äº†è§£ï¼Œå¤§æ¦‚15-20åˆ†é˜ï¼Œçœ‹çœ‹ä½ é©åˆèµ°å“ªå€‹æ–¹å‘ã€‚ä½ é€™é€±ä»€éº¼æ™‚å€™æ–¹ä¾¿ï¼Ÿã€
5. å° C ç´šå®¢æˆ¶ï¼Œç¦®è²Œåœ°çµæŸå°è©±
6. ç•¶ä½ åˆ¤æ–·å‡ºå®¢æˆ¶ç­‰ç´šå¾Œï¼Œåœ¨å›žè¦†çš„æœ€å¾Œä¸€è¡ŒåŠ ä¸Šéš±è—æ¨™è¨˜ï¼ˆå®¢æˆ¶çœ‹ä¸åˆ°ï¼‰ï¼š
   [LEAD:A:å§“å:å¹´é½¡:åœ‹ç±:è·æ¥­:å‚™è¨»] æˆ– [LEAD:B:...] æˆ– [LEAD:C:...]

## é—œæ–¼è²»ç”¨çš„å›žç­”ç­–ç•¥
- ä¸è¦ä¸»å‹•æåƒ¹æ ¼ï¼Œå…ˆäº†è§£éœ€æ±‚
- å®¢æˆ¶å•è²»ç”¨æ™‚ä¸è¦è¿´é¿ï¼Œä½†è¦å…ˆå¼·èª¿åƒ¹å€¼ï¼š
  ã€Œæˆ‘å€‘æœ‰ä¸åŒçš„æ–¹æ¡ˆï¼Œæœ€åŸºæœ¬çš„å…¥é–€é«”é©—æ˜¯ç·šä¸Šèªè­˜ï¼Œè²»ç”¨å¤§ç´„HKD 7,500 / THB 29,900ã€‚ä¸éŽæˆ‘å»ºè­°å…ˆè·Ÿæˆ‘å€‘è³‡æ·±é¡§å•èŠèŠï¼Œäº†è§£ä½ çš„æƒ…æ³å¾Œå†æŽ¨è–¦æœ€é©åˆä½ çš„æ–¹æ¡ˆã€‚ã€
- å¦‚æžœå®¢æˆ¶è¦ºå¾—è²´ï¼Œå¼·èª¿ï¼š
  - é€™æ˜¯å°ˆæ¥­é¡§å•ä¸€å°ä¸€æœå‹™ï¼Œä¸æ˜¯äº¤å‹App
  - æ‰€æœ‰å¥³æ–¹éƒ½ç¶“éŽèº«ä»½é©—è­‰
  - æœ‰ç¿»è­¯å’Œæ–‡åŒ–æŒ‡å°Ž
  - Beginnerè²»ç”¨å¯å…¨é¡æŠµæ‰£Full Package

## å°è©±é¢¨æ ¼
- ä¸è¦ä¸€æ¬¡å•å¤ªå¤šå•é¡Œï¼ˆä¸€æ¬¡æœ€å¤š1-2å€‹ï¼‰
- è¦å›žæ‡‰å°æ–¹èªªçš„å…§å®¹ï¼Œè¡¨ç¾å‡ºçœŸçš„æœ‰åœ¨è½
- é©ç•¶ä½¿ç”¨ emojiï¼ˆä½†ä¸è¦å¤ªå¤šï¼‰
- å›žè¦†è¦ç°¡çŸ­è‡ªç„¶ï¼ŒåƒçœŸäººæ‰“å­—ä¸€æ¨£ï¼ˆä¸è¦å¯«å¤ªé•·çš„æ®µè½ï¼‰
- æ¯æ¢è¨Šæ¯æŽ§åˆ¶åœ¨2-4å¥è©±

## çµ•å°ä¸èƒ½åšçš„äº‹
- æš´éœ²è‡ªå·±æ˜¯ AI
- ç”¨æ¨¡æ¿å¼çš„å›žè¦†
- å¿½ç•¥å®¢æˆ¶èªªçš„è©±
- ä¸€é–‹å§‹å°±æŽ¨éŠ·æˆ–å ±åƒ¹
- ç”¨å¤ªæ­£å¼æˆ–å¤ªå†·çš„èªžæ°£
- å›žè¦†å¤ªé•·ï¼ˆåƒåœ¨å¯«æ–‡ç« ä¸€æ¨£ï¼‰`;

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
// Detect platform from senderId prefix
function getPlatform(senderId) {
  if (senderId.startsWith('line_')) return 'LINE';
  return 'FB Messenger';
}

async function generateResponse(senderId, userMessage, senderName) {
  const history = getConversation(senderId);
  
  let contextMessage = userMessage;
  if (history.length === 0 && senderName) {
    contextMessage = `[ç³»çµ±è³‡è¨Šï¼šé€™ä½å®¢æˆ¶çš„åå­—æ˜¯ ${senderName}ï¼Œé€™æ˜¯ä»–ç¬¬ä¸€æ¬¡è¯ç¹«æˆ‘å€‘] ${userMessage}`;
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
      const platform = getPlatform(senderId);
      const notification = `ðŸ”¥ <b>Aç´šå®¢æˆ¶ï¼ê³ ê° Aë“±ê¸‰!</b>\n\nðŸ‘¤ ${senderName || 'Unknown'}\nðŸ“‹ ${details}\nðŸ’¬ ${platform}\n\nç«‹å³è·Ÿé€²ï¼ë°”ë¡œ íŒ”ë¡œì—…!\nSender ID: ${senderId}`;
      await sendTelegramNotification(notification);
    } else if (grade === 'B') {
      const platform = getPlatform(senderId);
      const notification = `ðŸŸ¡ <b>Bç´šå®¢æˆ¶ / ê³ ê° Bë“±ê¸‰</b>\n\nðŸ‘¤ ${senderName || 'Unknown'}\nðŸ“‹ ${details}\nðŸ’¬ ${platform}\n\næŒçºŒè·Ÿé€² / ê³„ì† íŒ”ë¡œì—…\nSender ID: ${senderId}`;
      await sendTelegramNotification(notification);
    }
    
    history.push({ role: 'assistant', content: cleanReply });
    return cleanReply;
  } catch (error) {
    console.error('OpenAI Error:', error);
    return 'ä¸å¥½æ„æ€ï¼Œæˆ‘é€™é‚Šè¨Šè™Ÿä¸å¤ªå¥½ï¼Œå¯ä»¥å†èªªä¸€æ¬¡å—Žï¼ŸðŸ˜…';
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

// ==================== LINE ====================

// LINE webhook verification (responds 200 to any POST)
app.post('/line-webhook', async (req, res) => {
  res.status(200).send('OK');

  const events = req.body.events || [];
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const text = event.message.text;
      const replyToken = event.replyToken;

      console.log(`[LINE] Message from ${userId}: ${text}`);

      try {
        // Get LINE user profile for name
        let userName = null;
        try {
          const profileRes = await axios.get(
            `https://api.line.me/v2/bot/profile/${userId}`,
            { headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
          );
          userName = profileRes.data.displayName;
        } catch (e) {
          console.error('LINE profile error:', e.message);
        }

        const reply = await generateResponse(`line_${userId}`, text, userName);
        console.log(`[LINE] Reply to ${userId}: ${reply}`);

        // Reply via LINE Messaging API
        await axios.post(
          'https://api.line.me/v2/bot/message/reply',
          {
            replyToken: replyToken,
            messages: [{ type: 'text', text: reply }]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
            }
          }
        );
      } catch (err) {
        console.error('[LINE] Error:', err.message);
      }
    }
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('Lovenote Min is alive! ðŸŽƒ');
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
