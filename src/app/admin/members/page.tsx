import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasMasterAccess } from "@/lib/admin-auth";
import { MemberRoleEditor } from "./MemberRoleEditor";
import type { Profile } from "@/types/supabase";

export const metadata: Metadata = { title: "회원관리" };

const ROLE_ORDER: Record<Profile["role"], number> = {
  master: 0,
  admin: 1,
  staff: 2,
  member: 3,
};

const ROLE_LABEL: Record<Profile["role"], string> = {
  master: "Master",
  admin: "Admin",
  staff: "Staff",
  member: "Member",
};

const ROLE_BADGE: Record<Profile["role"], string> = {
  master: "bg-purple-100 text-purple-700",
  admin: "bg-red-100 text-red-700",
  staff: "bg-blue-100 text-blue-700",
  member: "bg-gray-100 text-gray-600",
};

export default async function MembersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/members");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (!hasMasterAccess(me?.role)) {
    redirect("/admin?notice=no_master");
  }

  const { data: rawMembers } = await supabase
    .from("profiles")
    .select("id, name, email, role, avatar_url, created_at")
    .order("created_at", { ascending: false });

  const members = ((rawMembers ?? []) as Pick<
    Profile,
    "id" | "name" | "email" | "role" | "avatar_url" | "created_at"
  >[])
    .slice()
    .sort((a, b) => {
      const ra = ROLE_ORDER[a.role] ?? 99;
      const rb = ROLE_ORDER[b.role] ?? 99;
      if (ra !== rb) return ra - rb;
      return b.created_at.localeCompare(a.created_at);
    });

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">회원관리</h1>
      <p className="mb-6 text-sm text-gray-500">
        총 {members.length}명. 본인의 권한은 변경할 수 없습니다.
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">회원</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3">현재 권한</th>
              <th className="px-4 py-3">변경</th>
              <th className="px-4 py-3">가입일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => {
              const isSelf = m.id === user.id;
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.avatar_url}
                          alt=""
                          className="h-8 w-8 rounded-full border border-gray-100 object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-500">
                          {(m.name || "?").charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-gray-900">
                        {m.name || "(이름없음)"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.email || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[m.role]}`}
                    >
                      {ROLE_LABEL[m.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <MemberRoleEditor
                      id={m.id}
                      currentRole={m.role}
                      isSelf={isSelf}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {m.created_at.slice(0, 10)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
