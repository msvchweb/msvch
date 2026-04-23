import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { LogoutButton } from "@/components/LogoutButton";
import type { Metadata } from "next";
import type { Profile } from "@/types/supabase";

export const metadata: Metadata = { title: "내 프로필" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = (await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  return (
    <>
      <PageHeader title="내 프로필" />
      <Container>
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8">
          {profile?.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              className="mx-auto mb-5 h-20 w-20 rounded-full border border-gray-100 object-cover"
            />
          )}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">이름</label>
              <p className="mt-1 text-gray-900">
                {profile?.name || "미설정"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                이메일
              </label>
              <p className="mt-1 text-gray-900">
                {profile?.email ?? user.email}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                가입일
              </label>
              <p className="mt-1 text-gray-900">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("ko-KR")
                  : "-"}
              </p>
            </div>
          </div>
          <div className="mt-8">
            <LogoutButton />
          </div>
        </div>
      </Container>
    </>
  );
}
