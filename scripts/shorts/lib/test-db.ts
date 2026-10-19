import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

/** Executes actual PostgreSQL/RLS, without production credentials. PGlite is single-session. */
export async function createTestDb(includePublishing = false) {
  const db = new PGlite();
  await installShortsTestSchema(db, includePublishing);
  return db;
}
/** Shared isolated fixture: also exercised with native PostgreSQL connections. */
export async function installShortsTestSchema(
  db: { exec: (sql: string) => Promise<unknown> },
  includePublishing = false,
) {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql as $$ select current_user::text $$;
    create table public.profiles(id uuid primary key, role text);
    create function public.is_admin_or_master() returns boolean language sql stable security definer
      set search_path = '' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','master')) $$;
    create table storage.buckets(id text primary key, name text, public boolean);
    create table storage.objects(id uuid, bucket_id text);
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select on profiles to authenticated;
  `);
  await db.exec(readFileSync("supabase/migrations/005_shorts.sql", "utf8"));
  await db.exec(`alter table shorts_jobs add column highlight_count int not null default 5;
    insert into shorts_jobs(id,video_id,video_title) values ('10000000-0000-4000-8000-000000000001','abcdefghijk','설교');
    insert into shorts_clips(id,job_id,clip_index,start_sec,end_sec,transcript,video_url)
    values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',0,70,100,'기존 선정 이유','https://example.com/old.mp4');
    grant all on all tables in schema public to service_role;
  `);
  for (const suffix of [
    "shorts_generation_reliability.sql",
    ...(includePublishing ? ["shorts_publications.sql"] : []),
  ]) {
    const file = readdirSync("supabase/migrations").find((f) =>
      f.endsWith(suffix),
    );
    if (!file) throw new Error(`Migration missing: ${suffix}`);
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  }
}
