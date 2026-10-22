// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("enforces AI course grants, role policies, input constraints and transaction rollback in PostgreSQL", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      CREATE TABLE public.profiles(id uuid PRIMARY KEY, role text);
      INSERT INTO public.profiles VALUES
        ('00000000-0000-4000-8000-000000000001','member'),
        ('00000000-0000-4000-8000-000000000002','staff'),
        ('00000000-0000-4000-8000-000000000003','admin'),
        ('00000000-0000-4000-8000-000000000004','master');
      CREATE FUNCTION public.is_admin_or_master() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
        SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','master'))
      $$;
    `);
    await db.exec(await readFile(new URL("../migrations/20261022030357_ai_course_applications.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("./ai-course-applications.sql", import.meta.url), "utf8"));
    const result = await db.query<{ count: number }>("SELECT count(*)::integer AS count FROM public.ai_course_applications");
    expect(result.rows[0].count).toBe(0);
  } finally { await db.close(); }
}, 30_000);
