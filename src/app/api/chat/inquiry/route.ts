import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { z } from "zod";

const InquirySchema = z.object({
  name: z.string().min(1).max(50),
  phone: z.string().min(9).max(20),
  message: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = InquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("chat_inquiries")
    .insert(parsed.data);

  if (error) {
    console.error("Inquiry insert error:", error);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "명성비전교회 <onboarding@resend.dev>",
        to: "msvch01@naver.com",
        subject: `[문의] ${parsed.data.name}님의 문의가 접수되었습니다`,
        html: `
          <h2>새 문의가 접수되었습니다</h2>
          <table style="border-collapse:collapse;width:100%;max-width:480px">
            <tr>
              <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;width:80px">이름</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb">${parsed.data.name}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;background:#f3f4f6;font-weight:600">연락처</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb">${parsed.data.phone}</td>
            </tr>
            ${parsed.data.message ? `
            <tr>
              <td style="padding:8px 12px;background:#f3f4f6;font-weight:600">메시지</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb">${parsed.data.message}</td>
            </tr>` : ""}
          </table>
          <p style="margin-top:16px;color:#6b7280;font-size:14px">관리자 페이지에서 전체 문의 내역을 확인하실 수 있습니다.</p>
        `,
      });
    } catch (emailError) {
      console.error("Email send error:", emailError);
    }
  }

  return NextResponse.json({ ok: true });
}
