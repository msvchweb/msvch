import Link from "next/link";
import type { Metadata } from "next";
import {
  UserPlus,
  MessageSquare,
  Calendar,
  Newspaper,
  FileText,
  ImageIcon,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "관리자 대시보드" };

/** 한국 시간대(UTC+9) 기준 오늘 00:00 의 ISO 문자열 */
function todayStartIso(): string {
  const now = new Date();
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffsetMs);
  kstNow.setUTCHours(0, 0, 0, 0);
  return new Date(kstNow.getTime() - kstOffsetMs).toISOString();
}

/** YYYY-MM-DD (KST) */
function ymd(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

interface RecentNewFamily {
  id: string;
  name: string;
  status: string;
  created_at: string;
}
interface RecentInquiry {
  id: string;
  name: string;
  message: string | null;
  created_at: string;
}
interface RecentBoardPost {
  id: string;
  title: string;
  author_name: string;
  board_id: string;
  created_at: string;
}
interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  const today = new Date();
  const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const todayDate = ymd(today);
  const weekLaterDate = ymd(sevenDaysLater);
  const todayIso = todayStartIso();

  const [
    newFamilyPendingRes,
    todayInquiryCountRes,
    upcomingEventCountRes,
    upcomingEventsRes,
    recentNewFamilyRes,
    recentInquiryRes,
    recentBoardPostsRes,
  ] = await Promise.all([
    supabase
      .from("new_family_registrations")
      .select("*", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("chat_inquiries")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayIso),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .gte("date", todayDate)
      .lte("date", weekLaterDate),
    supabase
      .from("events")
      .select("id, title, date, start_time")
      .gte("date", todayDate)
      .lte("date", weekLaterDate)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: true })
      .limit(5),
    supabase
      .from("new_family_registrations")
      .select("id, name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("chat_inquiries")
      .select("id, name, message, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("board_posts")
      .select("id, title, author_name, board_id, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const newFamilyPending = newFamilyPendingRes.count ?? 0;
  const todayInquiryCount = todayInquiryCountRes.count ?? 0;
  const upcomingEventCount = upcomingEventCountRes.count ?? 0;
  const upcomingEvents = (upcomingEventsRes.data ?? []) as UpcomingEvent[];
  const recentNewFamily = (recentNewFamilyRes.data ?? []) as RecentNewFamily[];
  const recentInquiry = (recentInquiryRes.data ?? []) as RecentInquiry[];
  const recentBoardPosts = (recentBoardPostsRes.data ?? []) as RecentBoardPost[];

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">대시보드</h1>

      {/* A — 처리 대기 */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          처리 대기
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <ActionCard
            href="/admin/new-families"
            icon={UserPlus}
            label="새가족 신청"
            value={newFamilyPending}
            hint={newFamilyPending > 0 ? "확인 필요" : "처리 완료"}
            tone={newFamilyPending > 0 ? "alert" : "neutral"}
          />
          <ActionCard
            href="/admin/inquiries"
            icon={MessageSquare}
            label="오늘 문의"
            value={todayInquiryCount}
            hint={todayInquiryCount > 0 ? "확인 필요" : "신규 없음"}
            tone={todayInquiryCount > 0 ? "alert" : "neutral"}
          />
          <ActionCard
            href="/admin/calendar"
            icon={Calendar}
            label="7일 내 일정"
            value={upcomingEventCount}
            hint={upcomingEventCount > 0 ? "예정됨" : "없음"}
            tone={upcomingEventCount > 0 ? "info" : "neutral"}
          />
        </div>
      </section>

      {/* C — 빠른 진입 */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          빠른 작성
        </h2>
        <div className="grid gap-2 sm:grid-cols-4">
          <QuickAction href="/admin/notices" icon={Newspaper} label="공지 작성" />
          <QuickAction href="/admin/weeklies/new" icon={FileText} label="주보 작성" />
          <QuickAction href="/admin/calendar" icon={Calendar} label="일정 등록" />
          <QuickAction href="/admin/gallery" icon={ImageIcon} label="앨범 만들기" />
        </div>
      </section>

      {/* B — 최근 활동 */}
      <section className="grid gap-6 lg:grid-cols-2">
        <RecentList
          title="다가오는 일정"
          emptyText="7일 내 일정 없음"
          href="/admin/calendar"
          items={upcomingEvents.map((e) => ({
            id: e.id,
            primary: e.title,
            secondary: `${e.date}${e.start_time ? ` · ${e.start_time.slice(0, 5)}` : ""}`,
            href: "/admin/calendar",
          }))}
        />
        <RecentList
          title="최근 새가족 신청"
          emptyText="신청 없음"
          href="/admin/new-families"
          items={recentNewFamily.map((n) => ({
            id: n.id,
            primary: n.name,
            secondary: `${formatRelative(n.created_at)} · ${statusLabel(n.status)}`,
            href: "/admin/new-families",
          }))}
        />
        <RecentList
          title="최근 문의"
          emptyText="문의 없음"
          href="/admin/inquiries"
          items={recentInquiry.map((q) => ({
            id: q.id,
            primary: q.name,
            secondary: q.message
              ? truncate(q.message, 40)
              : formatRelative(q.created_at),
            href: "/admin/inquiries",
          }))}
        />
        <RecentList
          title="최근 게시판 글"
          emptyText="새 글 없음"
          href="/admin/boards"
          items={recentBoardPosts.map((p) => ({
            id: p.id,
            primary: p.title,
            secondary: `${p.author_name} · ${formatRelative(p.created_at)}`,
            href: "/admin/boards",
          }))}
        />
      </section>
    </div>
  );
}

type Tone = "alert" | "info" | "neutral";

const TONE_CARD: Record<Tone, string> = {
  alert: "border-rose-200 bg-rose-50",
  info: "border-blue-200 bg-blue-50",
  neutral: "border-gray-200 bg-white",
};
const TONE_ICON: Record<Tone, string> = {
  alert: "bg-rose-100 text-rose-600",
  info: "bg-blue-100 text-blue-600",
  neutral: "bg-gray-100 text-gray-500",
};
const TONE_VALUE: Record<Tone, string> = {
  alert: "text-rose-700",
  info: "text-blue-700",
  neutral: "text-gray-900",
};

function ActionCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  tone: Tone;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 rounded-xl border p-4 transition-colors ${TONE_CARD[tone]} hover:border-gray-300`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TONE_ICON[tone]}`}
      >
        <Icon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-600">{label}</p>
        <p className={`mt-0.5 text-2xl font-bold ${TONE_VALUE[tone]}`}>{value}</p>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>
      <ChevronRight
        size={18}
        className="shrink-0 text-gray-300 transition-colors group-hover:text-gray-500"
      />
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
    >
      <Icon size={18} className="text-gray-500" />
      {label}
    </Link>
  );
}

interface RecentListItem {
  id: string;
  primary: string;
  secondary: string;
  href: string;
}

function RecentList({
  title,
  emptyText,
  href,
  items,
}: {
  title: string;
  emptyText: string;
  href: string;
  items: RecentListItem[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <Link
          href={href}
          className="flex items-center gap-0.5 text-xs font-medium text-gray-500 hover:text-primary-600"
        >
          전체
          <ChevronRight size={14} />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {item.primary}
                  </p>
                  <p className="truncate text-xs text-gray-500">{item.secondary}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-gray-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case "new":
      return "신규";
    case "contacted":
      return "연락함";
    case "assigned":
      return "배정됨";
    case "done":
      return "완료";
    default:
      return s;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return iso.slice(0, 10);
}

