"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, CheckCircle2, User, Phone, Instagram, Calendar, Users } from "lucide-react";
import { PRIVACY_POLICY_TEXT } from "../new-family/privacy-policy";

type Step = "intro" | "form" | "done";

export default function QuickRegistPage() {
  const [step, setStep] = useState<Step>("intro");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [ageGroup, setAgeGroup] = useState("");
  const [contactType, setContactType] = useState<"phone" | "instagram">("phone");
  const [contactValue, setContactValue] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ageGroups = ["10대", "20대", "30대", "40대", "50대", "60대 이상"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("이름을 입력해 주세요.");
    if (!gender) return setError("성별을 선택해 주세요.");
    if (!ageGroup) return setError("연령대를 선택해 주세요.");
    if (!contactValue.trim()) return setError(contactType === "phone" ? "연락처를 입력해 주세요." : "인스타그램 아이디를 입력해 주세요.");
    if (!consent) return setError("개인정보 수집 및 이용에 동의해 주세요.");

    setLoading(true);
    try {
      const res = await fetch("/api/new-family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          gender,
          ageGroup,
          phone: contactType === "phone" ? contactValue.trim() : undefined,
          instagramId: contactType === "instagram" ? contactValue.trim() : undefined,
          privacyConsent: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "등록에 실패했습니다.");
      }

      setStep("done");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === "intro") {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <div className="relative aspect-[3/4] w-full overflow-hidden">
          <Image
            src="/images/main.jpg"
            alt="명성비전교회"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-12 left-0 w-full px-8 text-white">
            <h1 className="text-3xl font-bold leading-tight">
              당신을 향한<br />하나님의 사랑
            </h1>
            <p className="mt-4 text-lg font-medium opacity-90">
              명성비전교회에 오신 것을<br />진심으로 환영합니다.
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 py-12">
          <p className="text-center text-gray-600 leading-relaxed">
            아래 버튼을 눌러 정보를 남겨주시면<br />
            따뜻한 안내와 선물을 드립니다.
          </p>
          <button
            onClick={() => setStep("form")}
            className="w-full max-w-sm rounded-full bg-primary-600 py-4 text-lg font-bold text-white shadow-xl shadow-primary-600/20 active:scale-95 transition"
          >
            환영 카드 작성하기
          </button>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-8 text-center">
        <div className="mb-6 rounded-full bg-green-100 p-4">
          <CheckCircle2 size={48} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">반갑습니다!</h2>
        <p className="mt-4 text-gray-600 leading-relaxed">
          정보를 소중히 잘 받았습니다.<br />
          곧 연락드리고 환영하겠습니다.<br /><br />
          행복한 주일 되세요!
        </p>
        <button
          onClick={() => window.location.href = "/"}
          className="mt-12 text-sm font-medium text-gray-400 hover:text-primary-600"
        >
          홈으로 이동
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-gray-900">환영 카드</h2>
          <p className="mt-2 text-sm text-gray-500">정보를 남겨주시면 소중히 안내하겠습니다.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            {/* 이름 */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <User size={16} className="text-gray-400" />
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-primary-500 focus:bg-white focus:ring-primary-500 transition"
              />
            </div>

            {/* 성별 */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Users size={16} className="text-gray-400" />
                성별
              </label>
              <div className="grid grid-cols-2 gap-3">
                {["male", "female"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g as any)}
                    className={`rounded-xl py-3 text-sm font-medium transition ${
                      gender === g
                        ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20"
                        : "bg-gray-50 text-gray-600 border border-gray-100"
                    }`}
                  >
                    {g === "male" ? "남성" : "여성"}
                  </button>
                ))}
              </div>
            </div>

            {/* 연령대 */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Calendar size={16} className="text-gray-400" />
                연령대
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ageGroups.map((age) => (
                  <button
                    key={age}
                    type="button"
                    onClick={() => setAgeGroup(age)}
                    className={`rounded-xl py-2.5 text-xs font-medium transition ${
                      ageGroup === age
                        ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20"
                        : "bg-gray-50 text-gray-600 border border-gray-100"
                    }`}
                  >
                    {age}
                  </button>
                ))}
              </div>
            </div>

            {/* 연락처 선택 */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                {contactType === "phone" ? <Phone size={16} className="text-gray-400" /> : <Instagram size={16} className="text-gray-400" />}
                연락처
              </label>
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setContactType("phone"); setContactValue(""); }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${contactType === "phone" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500"}`}
                >
                  전화번호
                </button>
                <button
                  type="button"
                  onClick={() => { setContactType("instagram"); setContactValue(""); }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${contactType === "instagram" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500"}`}
                >
                  인스타그램
                </button>
              </div>
              <input
                type={contactType === "phone" ? "tel" : "text"}
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                placeholder={contactType === "phone" ? "010-0000-0000" : "@instagram_id"}
                className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-primary-500 focus:bg-white focus:ring-primary-500 transition"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="text-xs text-gray-500 leading-normal">
                  <span className="font-bold text-gray-700">[필수] 개인정보 수집 및 이용 동의</span>
                  <p className="mt-1 line-clamp-2">
                    {PRIVACY_POLICY_TEXT}
                  </p>
                </div>
              </label>
            </div>

            {error && (
              <p className="text-center text-sm font-medium text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-primary-600 py-4 text-lg font-bold text-white shadow-xl shadow-primary-600/20 active:scale-95 disabled:opacity-50 transition"
            >
              {loading ? <Loader2 className="mx-auto animate-spin" /> : "등록 완료하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
