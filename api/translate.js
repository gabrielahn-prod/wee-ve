/**
 * Weeve — 한국어 → 영어 번역 프록시 (스토리 카드 렌더링 전용)
 * NAVER Papago NMT API 사용 — https://developers.naver.com/docs/papago/
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
  // Vercel에는 NCP API Gateway 변수명을 권장하지만, 기존 로컬 설정의
  // PAPAGO_CLIENT_* 이름도 허용해 배포/로컬 환경 모두에서 동작하게 한다.
  const clientId = process.env.X_NCP_APIGW_API_KEY_ID || process.env.PAPAGO_CLIENT_ID;
  const clientSecret = process.env.X_NCP_APIGW_API_KEY || process.env.PAPAGO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Papago API credentials are not configured');
  }

  const r = await fetch('https://naveropenapi.apigw.ntruss.com/nmt/v1/translation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-NCP-APIGW-API-KEY-ID': clientId,
      'X-NCP-APIGW-API-KEY': clientSecret,
    },
    body: new URLSearchParams({ source: 'ko', target: 'en', text }),
  });
  if (!r.ok) return text; // 실패 시 원문 그대로 (best-effort)
  const data = await r.json();
  return data?.message?.result?.translatedText || text;
}
