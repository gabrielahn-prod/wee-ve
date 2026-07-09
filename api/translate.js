/**
 * Weeve — 한국어 → 영어 번역 프록시 (스토리 카드 렌더링 전용)
 * MyMemory Translation API 사용 (무료, API 키 불필요) — https://mymemory.translated.net/doc/spec.php
 * DB에는 원문 한국어가 그대로 저장되며, 이 함수는 카드 이미지 렌더링 직전에만 호출됩니다.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 지원합니다.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const texts = Array.isArray(body?.texts) ? body.texts : [];
  if (texts.length === 0) return res.status(400).json({ error: 'texts 배열이 필요합니다.' });
  if (texts.length > 20) return res.status(400).json({ error: '한 번에 최대 20개까지 번역할 수 있습니다.' });

  try {
    const translations = await Promise.all(texts.map(translateOne));
    return res.status(200).json({ translations });
  } catch (e) {
    return res.status(502).json({ error: '번역 서비스 호출에 실패했습니다.' });
  }
};

async function translateOne(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ko|en`;
  const r = await fetch(url);
  if (!r.ok) return text; // 실패 시 원문 그대로 (best-effort)
  const data = await r.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || /QUERY LENGTH LIMIT/i.test(translated) || /IS AN INVALID/i.test(translated)) {
    return text;
  }
  return translated;
}
