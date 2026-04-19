"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WeeklyForm } from "@/components/weekly/WeeklyForm";
import { WeeklyContentSchema, type WeeklyContentInput } from "@/lib/validation";

const defaultForm: WeeklyContentInput = {
  title: "",
  date: undefined,
  volume: null,
  issue: null,
  hymn_number: "",
  scripture: "",
  special_praise: {
    part1: { song: "", choir: "" },
    part2: { song: "", choir: "" },
  },
  sermon_title: "",
  sermon_pastor: "",
  closing_hymn: "",
  weekly_verse: "",
  afternoon_service: { scripture: "", title: "", pastor: "" },
  wednesday_service: { scripture: "", title: "" },
  dawn_readings: [],
  offering_members: { p1: "", p2: "", p3: "" },
  prayer_items: [],
  announcements: [],
  servants_text: "",
  offering_list_text: "",
  is_published: false,
  publish_channels: { website: false, alimtalk: false, instagram: false },
};

export default function AdminWeeklyNewPage() {
  const router = useRouter();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(data: WeeklyContentInput, publish: boolean) {
    const parsed = WeeklyContentSchema.safeParse(data);
    if (!parsed.success) return;

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">새 주보 작성</h1>
        <p className="mt-1 text-sm text-gray-500">
          내용을 입력하고 발행하면 홈페이지에 즉시 반영됩니다.
        </p>
      </div>
      <WeeklyForm
        initial={defaultForm}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
}
