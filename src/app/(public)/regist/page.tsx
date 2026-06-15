"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2, CheckCircle2, User, Phone, Calendar, Users, ChevronRight, Heart, MapPin, Bus, Train, Home } from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { PRIVACY_POLICY_TEXT } from "../new-family/privacy-policy";
import { cn } from "@/lib/utils";

type Step = "intro" | "form" | "done";

const CHURCH_ADDRESS = "서울시 동작구 사당로 16바길 9";

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

  // 페이지 진입 시 스크롤 상단 이동
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (step === "intro") {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-square md:aspect-video">
          <Image
            src="/images/main.jpg"
            alt="명성비전교회"
            fill
            className="object-cover scale-105 animate-in fade-in zoom-in duration-1000"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="absolute bottom-16 left-0 w-full px-10 text-white animate-fade-up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-md">
              <Heart size={12} className="text-red-400 fill-current" />
              <span>Welcome to MSVCH</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              당신을 향한<br />하나님의 사랑
            </h1>
            <p className="mt-6 text-lg font-medium text-white/80 leading-relaxed">
              명성비전교회에 오신 것을<br />진심으로 환영합니다.
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-10 py-16 text-center">
          <p className="text-gray-500 leading-relaxed max-w-xs">
            아래 버튼을 눌러 정보를 남겨주시면<br />
            따뜻한 안내와 정성스런 선물을 드립니다.
          </p>
          <button
            onClick={() => setStep("form")}
            className="group relative flex w-full max-w-sm items-center justify-center gap-2 overflow-hidden rounded-full bg-primary-600 py-5 text-xl font-bold text-white shadow-2xl shadow-primary-600/30 active:scale-95 transition-all duration-300"
          >
            <span>환영 카드 작성하기</span>
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex min-h-screen flex-col items-center bg-gray-50 px-6 py-16 animate-fade-in sm:px-10">
        <div className="mb-8 relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-green-200 opacity-20" />
          <div className="relative rounded-full bg-white p-6 shadow-xl ring-1 ring-green-100">
            <CheckCircle2 size={56} className="text-green-500" />
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight text-center">등록이 완료되었습니다!</h2>
        <div className="mt-6 space-y-2 text-lg text-gray-600 leading-relaxed text-center">
          <p>정보를 소중히 잘 받았습니다.</p>
          <p>곧 연락드리고 환영하겠습니다.</p>
        </div>
        <p className="mt-8 font-medium text-primary-600 italic text-center">&quot;행복한 주일 되세요!&quot;</p>

        <div className="mt-12 w-full max-w-md space-y-4">
          <div className="rounded-3xl bg-white p-8 shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
            <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900">
              <MapPin size={24} className="text-primary-600" />
              오시는 길 안내
            </h3>
            
            <div className="space-y-6">
              <div className="group">
                <p className="mb-2 text-sm font-bold text-gray-400 uppercase tracking-widest">주소</p>
                <p className="text-lg font-semibold text-gray-800 leading-snug">
                  {CHURCH_ADDRESS}<br />
                  <span className="text-sm font-medium text-primary-600">(사당4동 주민센터 옆)</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Train size={18} strokeWidth={2.5} />
                    <span className="text-sm font-bold">지하철</span>
                  </div>
                  <p className="text-sm font-medium text-gray-600">4호선 사당역<br />7호선 남성역</p>
                </div>
                <div className="space-y-2 border-l border-gray-50 pl-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <Bus size={18} strokeWidth={2.5} />
                    <span className="text-sm font-bold">버스</span>
                  </div>
                  <p className="text-sm font-medium text-gray-600">사당4동 주민센터<br />정류장 하차</p>
                </div>
              </div>
            </div>

            <a 
              href="/map" 
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-50 py-4 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              상세 지도 보기
              <ChevronRight size={16} />
            </a>
          </div>
        </div>
        
        <button
          onClick={() => window.location.href = "/"}
          className="mt-12 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-8 py-4 text-sm font-bold text-gray-600 shadow-sm hover:bg-gray-50 active:scale-95 transition"
        >
          <Home size={18} />
          홈으로 이동하기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 px-6 py-16 animate-fade-in">
      <div className="mx-auto max-w-md">
        <div className="mb-12 text-center animate-fade-up">
          <span className="inline-block rounded-full bg-primary-50 px-4 py-1.5 text-xs font-bold text-primary-600 uppercase tracking-widest mb-4">
            Welcome Card
          </span>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">하나님의 가족이 된<br />당신을 환영합니다</h2>
          <p className="mt-4 text-sm text-gray-500 leading-relaxed">소중한 정보를 남겨주시면<br />교회 소식과 선물을 정성껏 안내하겠습니다.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 animate-fade-up [animation-delay:200ms]">
          <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
            <div className="p-8 space-y-8">
              {/* 이름 */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-800">
                  <div className="rounded-lg bg-gray-50 p-1.5 text-gray-400">
                    <User size={16} />
                  </div>
                  이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력해 주세요"
                  className="w-full rounded-2xl border-gray-100 bg-gray-50 px-5 py-4 text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
                />
              </div>

              {/* 성별 */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-800">
                  <div className="rounded-lg bg-gray-50 p-1.5 text-gray-400">
                    <Users size={16} />
                  </div>
                  성별
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {(["male", "female"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={cn(
                        "relative flex items-center justify-center rounded-2xl py-4 text-sm font-bold transition-all duration-300",
                        gender === g
                          ? "bg-primary-600 text-white shadow-lg shadow-primary-600/30"
                          : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-transparent"
                      )}
                    >
                      {g === "male" ? "남성" : "여성"}
                      {gender === g && (
                        <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-white animate-pulse" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 연령대 */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-800">
                  <div className="rounded-lg bg-gray-50 p-1.5 text-gray-400">
                    <Calendar size={16} />
                  </div>
                  연령대
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {ageGroups.map((age) => (
                    <button
                      key={age}
                      type="button"
                      onClick={() => setAgeGroup(age)}
                      className={cn(
                        "rounded-xl py-3 text-xs font-bold transition-all duration-200",
                        ageGroup === age
                          ? "bg-primary-600 text-white shadow-md shadow-primary-600/20"
                          : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-transparent"
                      )}
                    >
                      {age}
                    </button>
                  ))}
                </div>
              </div>

              {/* 연락처 선택 */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-800">
                  <div className="rounded-lg bg-gray-50 p-1.5 text-gray-400">
                    {contactType === "phone" ? <Phone size={16} /> : <InstagramIcon size={16} />}
                  </div>
                  연락처
                </label>
                <div className="flex p-1 gap-1 rounded-xl bg-gray-100">
                  <button
                    type="button"
                    onClick={() => { setContactType("phone"); setContactValue(""); }}
                    className={cn(
                      "flex-1 rounded-lg py-2.5 text-xs font-bold transition-all",
                      contactType === "phone" ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    전화번호
                  </button>
                  <button
                    type="button"
                    onClick={() => { setContactType("instagram"); setContactValue(""); }}
                    className={cn(
                      "flex-1 rounded-lg py-2.5 text-xs font-bold transition-all",
                      contactType === "instagram" ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    인스타그램
                  </button>
                </div>
                <input
                  type={contactType === "phone" ? "tel" : "text"}
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  placeholder={contactType === "phone" ? "010-0000-0000" : "@instagram_id"}
                  className="w-full rounded-2xl border-gray-100 bg-gray-50 px-5 py-4 text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white/50 p-5 backdrop-blur-sm">
              <label className="flex cursor-pointer items-start gap-4">
                <div className="relative flex items-center h-6">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="peer h-6 w-6 rounded-lg border-2 border-gray-300 bg-white text-primary-600 transition-all checked:border-primary-600 focus:ring-primary-500 outline-none cursor-pointer"
                  />
                  <CheckCircle2 className="absolute h-4 w-4 left-1 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" strokeWidth={3} />
                </div>
                <div className="text-xs text-gray-500 leading-relaxed pt-0.5">
                  <span className="font-bold text-gray-800 underline underline-offset-4 decoration-primary-200">[필수] 개인정보 수집 및 이용 동의</span>
                  <div className="mt-3 h-24 overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-100 bg-white/30 p-3 text-[10px] leading-normal text-gray-400 scrollbar-thin">
                    {PRIVACY_POLICY_TEXT}
                  </div>
                </div>
              </label>
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-sm font-bold text-red-500 animate-in slide-in-from-top-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-full bg-primary-600 py-5 text-xl font-bold text-white shadow-xl shadow-primary-600/30 active:scale-[0.98] disabled:opacity-50 transition-all duration-300"
            >
              <div className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    <span>등록 완료하기</span>
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
