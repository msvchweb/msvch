-- Chat rate limiting table
create table public.chat_rate_limit (
  ip text not null,
  window_start timestamptz not null,
  request_count int not null default 1,
  primary key (ip, window_start)
);

-- 오래된 레코드는 자동 삭제 (1일 이상 지난 것)
create index chat_rate_limit_window_idx on public.chat_rate_limit (window_start);

alter table public.chat_rate_limit enable row level security;

-- API route는 service role key로 접근하므로 RLS는 모두 차단 (service role은 RLS 우회)
-- 일반 사용자/anon은 접근 불가
