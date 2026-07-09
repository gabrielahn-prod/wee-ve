# Weeve — Phase 1 (웹 바이럴 · 데이터 수집)

"나만의 비밀 데이트코스" 공유 카드 생성 웹사이트. 앱 없이 코스 데이터(지하철역·시간·장소 순서·사진)를
수집하고, 인스타 스토리용 카드를 만들어 바이럴을 일으키는 것이 목표입니다.

- `index.html` — 코스 입력 폼 + 스토리 카드 생성/다운로드/공유 (메인 서비스)
- `admin.html` — 비밀번호로 보호된 관리자 대시보드 (`/admin`) — 코스 데이터·대기자 리스트 조회
- `api/admin-data.js` — Vercel 서버리스 함수. `service_role` 키로 Supabase에 접근하며 admin.html에서만 호출
- `config.js` — Supabase 접속 정보 (gitignore 처리됨, 절대 커밋 금지)

architecture는 expDate 프로젝트와 동일한 패턴을 따릅니다: 빌드 툴 없는 정적 HTML + Supabase JS SDK(CDN) +
Vercel 서버리스 API. `config.js`가 없거나 값이 비어 있으면 두 페이지 모두 **데모 모드**로 동작해서
Supabase 연결 전에도 화면 흐름을 확인할 수 있습니다.

## 1. Supabase 프로젝트 설정

[supabase.com](https://supabase.com) 에서 프로젝트를 만든 뒤 **SQL Editor**에서 아래 스크립트를 한 번만 실행하세요.

```sql
-- ── 코스 데이터 (Phase 1 핵심 테이블) ──────────────────────────
create table courses (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  nickname         text not null,              -- "수민이" → 카드엔 "수민이의 데이트 코스"
  subway_station   text,                       -- 만난 지하철역
  meet_time        text,                       -- "14:00"
  end_time         text,                       -- "21:00"
  places           jsonb not null default '[]', -- [{order, name, photo_url}]
  consent          boolean not null default false, -- 개인정보 수집·이용 동의
  waitlist_email   text,                       -- 코스 생성 시 선택 입력한 이메일 (있으면 waitlist에도 저장)
  utm_source       text,
  utm_medium       text,
  utm_campaign     text
);

alter table courses enable row level security;

-- 누구나 코스 등록(INSERT) 가능. 조회(SELECT)는 막아서 다른 사람 코스를 API로 못 훑어보게 함.
create policy "public_insert_courses"
  on courses for insert to anon with check (true);

-- ── 대기자 리스트 (앱 출시 알림) ──────────────────────────────
create table waitlist (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  email       text not null unique,
  source      text default 'phase1_course', -- 'phase1_course' | 'phase2_landing' 등
  consent     boolean not null default false,
  utm_source  text,
  utm_medium  text,
  utm_campaign text
);

alter table waitlist enable row level security;

create policy "public_insert_waitlist"
  on waitlist for insert to anon with check (true);

-- ── 장소 사진 저장용 Storage ──────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('course-photos', 'course-photos', true)
  on conflict (id) do nothing;

create policy "anon upload course photos"
  on storage.objects for insert to anon
  with check (bucket_id = 'course-photos');

create policy "anyone view course photos"
  on storage.objects for select
  using (bucket_id = 'course-photos');
```

> `courses`/`waitlist` 모두 anon 키로는 **INSERT만** 가능하고 SELECT/DELETE는 막혀 있습니다.
> 관리자 조회·삭제는 `api/admin-data.js`가 `service_role` 키로 서버에서만 수행합니다 — 절대 프론트엔드에
> service_role 키를 노출하지 마세요.

키 발급 위치: Supabase 콘솔 → **Settings → API**
- `SUPABASE_URL` = Project URL
- `SUPABASE_ANON_KEY` = anon / public 키
- `SUPABASE_SERVICE_KEY` = service_role 키 (admin 전용, 절대 공개 금지)

## 2. 로컬 개발

1. `config.js`를 열어 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 값을 채워 넣습니다. (비워두면 데모 모드로 동작)
2. 정적 서버로 실행합니다. 예:
   ```bash
   npx serve .
   # 또는
   python3 -m http.server 5173
   ```
3. `admin.html`은 `/api/admin-data`를 호출하므로 로컬 정적 서버만으로는 실제 데이터를 불러오지 못하고
   자동으로 데모 모드로 표시됩니다. 실제 API까지 로컬에서 테스트하려면 `vercel dev`를 사용하세요
   (사전에 `.env`에 `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ADMIN_PASSWORD`를 채워야 합니다).

## 3. Vercel 배포

1. GitHub 레포와 Vercel 프로젝트를 연결합니다.
2. Vercel 프로젝트 → Settings → Environment Variables 에 아래 값을 등록합니다.
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `ADMIN_PASSWORD`
3. 배포 시 `build-config.js`가 `SUPABASE_URL`/`SUPABASE_ANON_KEY`만 골라 `config.js`를 자동 생성합니다
   (service key·admin 비밀번호는 절대 클라이언트 번들에 포함되지 않고 `api/` 서버 코드에서만 `process.env`로 읽힙니다).
4. 배포 후 `/admin` 경로로 접속하면 `ADMIN_PASSWORD`로 로그인해 대시보드를 볼 수 있습니다.

## 4. 지금 범위 / 다음 단계

- ✅ Phase 1: 코스 입력 → 카드 생성(다운로드/공유) → Supabase 저장 → admin 대시보드 조회
- 🎨 카드 디자인은 임시 템플릿입니다. 디자이너가 스토리 템플릿 최종본을 넘기면
  `drawCard()` (index.html 내 canvas 렌더링 함수)만 교체하면 됩니다.
- 📷 장소 사진을 올리지 않으면 `assets/demo/` 의 데모 이미지로 자동 대체됩니다. 실제 서비스에서는
  사용자가 업로드한 사진이 Supabase Storage(`course-photos` 버킷)에 저장됩니다.
- ⏭️ Phase 2(앱 사전예약 랜딩 페이지, 이메일 수집)는 별도로 진행 예정입니다. 다만 Phase 1 폼에서
  이메일을 선택 입력하면 이미 `waitlist` 테이블에 `source: 'phase1_course'`로 저장되어, admin
  대시보드의 "대기자 리스트" 탭에서 바로 확인할 수 있습니다.
- ⚠️ 동의 문구(`index.html`의 개인정보 수집·이용 동의 섹션)는 임시 문안입니다. 실제 서비스 오픈 전에
  법무 검토를 받아 정식 개인정보처리방침으로 교체하세요.
