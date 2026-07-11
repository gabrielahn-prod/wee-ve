const { createClient } = require('@supabase/supabase-js');

const TABLES = {
  courses: 'courses',
  waitlist: 'waitlist',
  survey: 'survey_responses',
};

function supabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY   // 서버에서만 사용 — 브라우저에 노출 안 됨
  );
}

function auth(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!auth(req)) {
    return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });
  }

  const table = TABLES[req.query.resource];
  if (!table) {
    return res.status(400).json({ error: 'resource 파라미터가 필요합니다 (courses | waitlist | survey)' });
  }

  const sb = supabase();

  /* GET — 전체 조회 */
  if (req.method === 'GET') {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  /* DELETE — 개별 삭제 (?resource=courses&id=uuid) */
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id 파라미터 필요' });

    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
