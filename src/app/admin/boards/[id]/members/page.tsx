"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, X, Search, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BoardMember } from "@/types/board";

interface ProfileSearchResult {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

type Params = Promise<{ id: string }>;

export default function AdminBoardMembersPage({
  params,
}: {
  params: Params;
}) {
  const { id: boardId } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      setLoading(true);
      const r = await fetch(`/api/admin/boards/${boardId}/members`, {
        credentials: "same-origin",
      });
      if (!cancelled && r.ok) {
        const data = (await r.json()) as BoardMember[];
        setMembers(data);
      }
      if (!cancelled) setLoading(false);
    }
    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  // 회원 검색 (250ms 디바운스)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const term = query.replace(/[%_]/g, "\\$&");
      const { data } = await supabase
        .from("profiles")
        .select("id, name, email, avatar_url")
        .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(20)
        .returns<ProfileSearchResult[]>();
      setResults(data ?? []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, supabase]);

  function addMember(p: ProfileSearchResult) {
    if (members.some((m) => m.profileId === p.id)) return;
    setMembers((prev) => [
      ...prev,
      {
        profileId: p.id,
        name: p.name ?? "(이름없음)",
        email: p.email,
        avatarUrl: p.avatar_url,
        addedAt: new Date().toISOString(),
      },
    ]);
    setQuery("");
    setResults([]);
  }

  function removeMember(profileId: string) {
    setMembers((prev) => prev.filter((m) => m.profileId !== profileId));
  }

  async function save() {
    setSaving(true);
    const r = await fetch(`/api/admin/boards/${boardId}/members`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileIds: members.map((m) => m.profileId) }),
    });
    setSaving(false);
    if (!r.ok) {
      alert("저장 실패");
      return;
    }
    alert("저장 완료");
    // 재조회
    const r2 = await fetch(`/api/admin/boards/${boardId}/members`, {
      credentials: "same-origin",
    });
    if (r2.ok) {
      const data = (await r2.json()) as BoardMember[];
      setMembers(data);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 size={20} className="mr-2 animate-spin" />
        로딩 중...
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/admin/boards"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} />
        게시판 목록
      </Link>

      <h1 className="mb-6 text-xl font-bold text-gray-900 sm:text-2xl">
        멤버 관리
      </h1>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          회원 검색 (이름 또는 이메일)
        </label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="홍길동 또는 hong@..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        {searching && (
          <p className="mt-2 text-xs text-gray-400">검색 중...</p>
        )}
        {results.length > 0 && (
          <ul className="mt-3 max-h-60 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
            {results.map((p) => {
              const already = members.some((m) => m.profileId === p.id);
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">
                      {p.name || "(이름없음)"}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {p.email}
                    </div>
                  </div>
                  <button
                    disabled={already}
                    onClick={() => addMember(p)}
                    className="ml-3 shrink-0 rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    {already ? "추가됨" : "추가"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            현재 멤버 ({members.length}명)
          </h2>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            저장
          </button>
        </div>

        {members.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            멤버가 없습니다.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <span
                key={m.profileId}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs"
              >
                {m.name}
                <button
                  onClick={() => removeMember(m.profileId)}
                  className="text-gray-400 hover:text-red-600"
                  aria-label="멤버 제거"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500">
          변경 후 [저장] 을 눌러야 적용됩니다.
        </p>
      </div>
    </div>
  );
}
