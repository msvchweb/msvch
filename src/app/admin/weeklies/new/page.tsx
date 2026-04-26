"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { applyPlaceholderDefaults } from "@/components/weekly/WeeklyForm";
import { WeeklyEditorWithPreview } from "@/components/weekly/WeeklyEditorWithPreview";
import { WeeklyContentSchema, createEmptyWeeklyInput, type WeeklyContentInput } from "@/lib/validation";

function getUpcomingSunday(): string {
  const today = new Date();
  const daysUntilSunday = today.getDay() === 0 ? 0 : 7 - today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + daysUntilSunday);
  return sunday.toISOString().split("T")[0];
}

const defaultForm: WeeklyContentInput = {
  ...createEmptyWeeklyInput(),
  date: getUpcomingSunday(),
};

export default function AdminWeeklyNewPage() {
  const router = useRouter();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(data: WeeklyContentInput, publish: boolean) {
    const parsed = WeeklyContentSchema.safeParse(applyPlaceholderDefaults(data));
    if (!parsed.success) {
      alert("입력 오류: " + parsed.error.issues.map((e) => e.message).join(", "));
      return;
    }

    setSubmitting(true);
    const payload = {
      ...parsed.data,
      is_published: publish || parsed.data.publish_channels.website,
    };

    const { error } = await supabase.from("weeklies").insert(payload);
    if (error) {
      alert("저장 실패: " + error.message);
      setSubmitting(false);
      return;
    }

    router.push("/admin/weeklies");
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">새 주보 작성</h1>
        <p className="mt-1 text-sm text-gray-500">
          내용을 입력하고 발행하면 홈페이지에 즉시 반영됩니다.
        </p>
      </div>
      <WeeklyEditorWithPreview
        initial={defaultForm}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
}
