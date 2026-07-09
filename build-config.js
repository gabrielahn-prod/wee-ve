/**
 * Vercel 빌드 시 환경변수 → config.js 자동 생성
 * 공개해도 안전한 키만 포함 (service key, admin password 제외)
 */
const fs = require('fs');

const output = `/* AUTO-GENERATED — do not edit (build-config.js가 생성) */
window.APP_CONFIG = {
  SUPABASE_URL:      ${JSON.stringify(process.env.SUPABASE_URL      || '')},
  SUPABASE_ANON_KEY: ${JSON.stringify(process.env.SUPABASE_ANON_KEY || '')},
};
`;

fs.writeFileSync('config.js', output);
console.log('✅ config.js 생성 완료 (service key / admin password 는 서버사이드 전용)');
