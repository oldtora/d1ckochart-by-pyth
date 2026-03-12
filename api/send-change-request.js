/**
 * Vercel serverless: send change request to Telegram bot.
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (both required).
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      return res.status(500).json({ ok: false, error: 'Server not configured' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        return res.status(400).json({ ok: false, error: 'Invalid JSON' });
      }
    }
    body = body || {};

    const text = (body.text || '').trim();
    if (!text) {
      return res.status(400).json({ ok: false, error: 'Empty text' });
    }

    const message = `📝 Change request:\n\n${text.slice(0, 4000)}`;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const tgRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true,
      }),
    });
    const data = await tgRes.json();

    if (!data.ok) {
      return res.status(502).json({ ok: false, error: data.description || 'Telegram error' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('send-change-request error:', e);
    return res.status(500).json({ ok: false, error: e.message || 'Internal error' });
  }
};
