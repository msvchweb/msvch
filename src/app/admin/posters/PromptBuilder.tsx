"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Image as ImageIcon,
  Download,
  Wand2,
} from "lucide-react";
import {
  POSTER_CATEGORIES,
  POSTER_RATIOS,
  POSTER_CATEGORY_LABEL,
  POSTER_RATIO_LABEL,
  COLOR_PALETTES,
  COLOR_PALETTE_DEFS,
  ART_STYLES,
  ART_STYLE_DEFS,
  MOODS,
  MOOD_DEFS,
  MOTIFS,
  MOTIF_DEFS,
  PEOPLE_HANDLINGS,
  PEOPLE_HANDLING_DEFS,
  REFERENCE_ASPECTS,
  REFERENCE_ASPECT_DEFS,
  DEFAULT_PROMPT_INPUT,
  type PosterCategory,
  type PosterRatio,
  type ColorPalette,
  type ArtStyle,
  type Mood,
  type Motif,
  type PeopleHandling,
  type ReferenceAspect,
} from "@/lib/poster-prompts";
import type { SharedPosterData } from "./PostersTabs";

interface BuildPromptResponse {
  englishPrompt: string;
  koreanSummary: string;
  error?: string;
}

const TARGET_TOOLS: { name: string; href: string; hint: string }[] = [
  {
    name: "ChatGPT",
    href: "https://chatgpt.com/",
    hint: "프롬프트를 그대로 붙여넣고 'generate an image' 라고 말해도 됩니다.",
  },
  {
    name: "Gemini",
    href: "https://gemini.google.com/",
    hint: "프롬프트를 붙여넣으면 이미지를 생성합니다.",
  },
  {
    name: "Midjourney",
    href: "https://www.midjourney.com/",
    hint: "프롬프트 앞에 /imagine 을 붙이거나 웹 입력창에 그대로 붙여넣으세요.",
  },
];

export function PromptBuilder({ onTransfer }: { onTransfer: (data: SharedPosterData) => void }) {
  const [category, setCategory] = useState<PosterCategory>("event");
  const [ratio, setRatio] = useState<PosterRatio>("a4");
  const [title, setTitle] = useState("");

  // 구조화 부가 정보
  const [schedules, setSchedules] = useState<string[]>([""]);
  const [location, setLocation] = useState("");
  const [audience, setAudience] = useState("");
  const [extraInfoText, setExtraInfoText] = useState(""); // 한 줄 = 한 항목

  // 칩 5종
  const [colorPalette, setColorPalette] = useState<ColorPalette>(DEFAULT_PROMPT_INPUT.colorPalette);
  const [artStyle, setArtStyle] = useState<ArtStyle>(DEFAULT_PROMPT_INPUT.artStyle);
  const [mood, setMood] = useState<Mood>(DEFAULT_PROMPT_INPUT.mood);
  const [motifs, setMotifs] = useState<Motif[]>(DEFAULT_PROMPT_INPUT.motifs);
  const [peopleHandling, setPeopleHandling] = useState<PeopleHandling>(
    DEFAULT_PROMPT_INPUT.peopleHandling,
  );

  // 참고 이미지
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [referenceAspect, setReferenceAspect] = useState<ReferenceAspect>("style");

  // 고급 옵션
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [moodKeywords, setMoodKeywords] = useState("");
  const [includeText, setIncludeText] = useState(true);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BuildPromptResponse | null>(null);
  // 결과 화면용 — submit 시점의 참고 이미지 미리보기 URL 을 보관
  const [resultRefPreview, setResultRefPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // DALL-E 직접 생성 관련
  const [generatingImage, setGeneratingImage] = useState(false);
  const [dalleImageUrl, setDalleImageUrl] = useState<string | null>(null);

  // 미리보기 URL 생명주기 관리
  useEffect(() => {
    if (!referenceFile) {
      setReferencePreview(null);
      return;
    }
    const url = URL.createObjectURL(referenceFile);
    setReferencePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [referenceFile]);

  // 결과 영역의 참고 이미지 URL 누수 방지
  useEffect(() => {
    return () => {
      if (resultRefPreview) URL.revokeObjectURL(resultRefPreview);
    };
  }, [resultRefPreview]);

  function handleReferenceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 첨부할 수 있습니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("참고 이미지는 5MB 이하만 가능합니다.");
      return;
    }
    setReferenceFile(file);
    e.target.value = "";
  }
  function clearReference() {
    setReferenceFile(null);
  }

  function toggleMotif(m: Motif) {
    setMotifs((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  }

  function updateSchedule(idx: number, value: string) {
    setSchedules((prev) => prev.map((s, i) => (i === idx ? value : s)));
  }
  function addScheduleRow() {
    setSchedules((prev) => (prev.length >= 20 ? prev : [...prev, ""]));
  }
  function removeScheduleRow(idx: number) {
    setSchedules((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [""] : next;
    });
  }

  async function handleGenerate() {
    if (!title.trim()) {
      alert("제목을 입력해 주세요.");
      return;
    }
    setLoading(true);
    setCopied(false);
    setDalleImageUrl(null); // 새 프롬프트 뽑으면 이전 생성 결과 리셋
    try {
      // 구조화 부가 정보 정리
      const cleanedSchedules = schedules.map((s) => s.trim()).filter((s) => s.length > 0);
      const cleanedExtraLines = extraInfoText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const payload = {
        category,
        ratio,
        title: title.trim(),
        schedules: cleanedSchedules,
        location: location.trim() || undefined,
        audience: audience.trim() || undefined,
        extraLines: cleanedExtraLines.length > 0 ? cleanedExtraLines : undefined,
        colorPalette,
        artStyle,
        mood,
        motifs,
        peopleHandling,
        moodKeywords: moodKeywords.trim() || undefined,
        includeText,
        referenceAspect: referenceFile ? referenceAspect : undefined,
      };

      const fd = new FormData();
      fd.append("payload", JSON.stringify(payload));
      if (referenceFile) fd.append("reference", referenceFile);

      const r = await fetch("/api/posters/build-prompt", {
        method: "POST",
        body: fd,
      });
      const data = (await r.json()) as BuildPromptResponse;
      if (!r.ok) {
        alert(data.error ?? "프롬프트 생성 실패");
        return;
      }
      setResult(data);
      // 결과 화면이 나중에 referenceFile 을 클리어해도 미리보기가 유지되도록 별도 보관
      setResultRefPreview(referenceFile ? URL.createObjectURL(referenceFile) : null);
    } catch (e) {
      console.error(e);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateImage() {
    if (!result?.englishPrompt) return;

    setGeneratingImage(true);
    try {
      const r = await fetch("/api/posters/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: result.englishPrompt,
          ratio: ratio,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        alert(data.error ?? "이미지 생성 실패");
        return;
      }
      setDalleImageUrl(data.imageUrl);
    } catch (e) {
      console.error(e);
      alert("이미지 생성 중 오류가 발생했습니다.");
    } finally {
      setGeneratingImage(false);
    }
  }

  function handleFinishAndEdit() {
    if (!dalleImageUrl) return;

    // 부제목(bodyText) 구성
    const cleanedSchedules = schedules.map((s) => s.trim()).filter((s) => s.length > 0);
    const bodyParts: string[] = [];
    if (cleanedSchedules.length > 0) bodyParts.push(cleanedSchedules.join(" / "));
    if (location.trim()) bodyParts.push(location.trim());
    if (audience.trim()) bodyParts.push(audience.trim());

    onTransfer({
      ratio,
      title: title.trim(),
      bodyText: bodyParts.join("\n"),
      imageUrl: dalleImageUrl,
    });
  }

  async function handleCopy() {
    if (!result?.englishPrompt) return;
    try {
      await navigator.clipboard.writeText(result.englishPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("클립보드 복사에 실패했습니다. 직접 선택해 복사해 주세요.");
    }
  }

  return (
    <div className="space-y-6">
      {/* ── 입력 폼 ───────────────────────────────────────── */}
      <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
        <Field label="카테고리">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {POSTER_CATEGORIES.map((c) => (
              <ChipButton key={c} active={category === c} onClick={() => setCategory(c)}>
                {POSTER_CATEGORY_LABEL[c]}
              </ChipButton>
            ))}
          </div>
        </Field>

        <Field label="비율">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {POSTER_RATIOS.map((r) => (
              <ChipButton key={r} active={ratio === r} onClick={() => setRatio(r)}>
                {POSTER_RATIO_LABEL[r]}
              </ChipButton>
            ))}
          </div>
        </Field>

        <Field label="제목 (필수)">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="예: 2026 봄 부흥회"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </Field>

        <Field
          label="📅 일시 (선택, 여러 회차 가능)"
          hint="회차마다 한 줄씩 — AI 가 각 항목을 별개 시각 단위로 처리합니다"
        >
          <div className="space-y-2">
            {schedules.map((s, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={s}
                  onChange={(e) => updateSchedule(idx, e.target.value)}
                  maxLength={120}
                  placeholder={
                    idx === 0
                      ? "예: 화 오후 8시"
                      : idx === 1
                        ? "예: 수 오후 7시 30분"
                        : "예: 목 오후 8시"
                  }
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                <button
                  type="button"
                  onClick={() => removeScheduleRow(idx)}
                  aria-label="이 일시 삭제"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addScheduleRow}
              disabled={schedules.length >= 20}
              className="flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-50"
            >
              <Plus size={12} />
              일시 추가
            </button>
          </div>
        </Field>

        <Field label="📍 장소 (선택)">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={120}
            placeholder="예: 본당 / 교육관 2층 갈릴리홀"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </Field>

        <Field label="🎤 대상 / 주관 / 강사 (선택)">
          <input
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            maxLength={120}
            placeholder="예: 전 교인 / 청년부 주관 / 강사 ○○○ 목사"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </Field>

        <Field
          label="📝 부가 정보 (선택)"
          hint="한 줄에 하나씩 — AI 가 각 줄을 별개 배지/인포칩으로 처리"
        >
          <textarea
            value={extraInfoText}
            onChange={(e) => setExtraInfoText(e.target.value)}
            rows={3}
            placeholder={"예:\n등록: 5월 3일까지\n문의: 02-534-0691\n자율 헌금"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </Field>

        <hr className="border-gray-100" />

        {/* ── 칩 5종 ─────────────────────────────────────── */}
        <Field label="🎨 색감">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COLOR_PALETTES.map((c) => {
              const def = COLOR_PALETTE_DEFS[c];
              return (
                <ChipButton key={c} active={colorPalette === c} onClick={() => setColorPalette(c)}>
                  <span className="flex items-center gap-1.5">
                    <span className="flex shrink-0 gap-0.5">
                      {def.swatch.map((sw, i) => (
                        <span
                          key={i}
                          className="h-3 w-3 rounded-full ring-1 ring-black/5"
                          style={{ backgroundColor: sw }}
                        />
                      ))}
                    </span>
                    <span className="truncate">{def.ko}</span>
                  </span>
                </ChipButton>
              );
            })}
          </div>
        </Field>

        <Field label="🖌 그림체">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ART_STYLES.map((s) => (
              <ChipButton key={s} active={artStyle === s} onClick={() => setArtStyle(s)}>
                {ART_STYLE_DEFS[s].ko}
              </ChipButton>
            ))}
          </div>
        </Field>

        <Field label="🌟 분위기">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MOODS.map((m) => (
              <ChipButton key={m} active={mood === m} onClick={() => setMood(m)}>
                {MOOD_DEFS[m].ko}
              </ChipButton>
            ))}
          </div>
        </Field>

        <Field
          label="🌸 시각 모티프"
          hint="여러 개 고를 수 있어요 (안 골라도 됨)"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MOTIFS.map((m) => (
              <ChipButton
                key={m}
                active={motifs.includes(m)}
                onClick={() => toggleMotif(m)}
              >
                {MOTIF_DEFS[m].ko}
              </ChipButton>
            ))}
          </div>
        </Field>

        <Field label="👥 사람 표현">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PEOPLE_HANDLINGS.map((p) => (
              <ChipButton
                key={p}
                active={peopleHandling === p}
                onClick={() => setPeopleHandling(p)}
              >
                {PEOPLE_HANDLING_DEFS[p].ko}
              </ChipButton>
            ))}
          </div>
        </Field>

        <Field
          label="🖼 참고 이미지 (선택)"
          hint="원하는 분위기·구도의 예시를 1장 올리면 AI 가 분석해서 프롬프트에 녹여줍니다"
        >
          {referencePreview ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={referencePreview}
                  alt="참고 이미지"
                  className="h-20 w-20 shrink-0 rounded-lg border border-gray-200 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-700">
                    {referenceFile?.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {referenceFile
                      ? `${(referenceFile.size / 1024).toFixed(0)} KB`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearReference}
                  aria-label="참고 이미지 제거"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                >
                  <X size={14} />
                </button>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-700">참고 측면</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {REFERENCE_ASPECTS.map((a) => (
                    <ChipButton
                      key={a}
                      active={referenceAspect === a}
                      onClick={() => setReferenceAspect(a)}
                    >
                      {REFERENCE_ASPECT_DEFS[a].ko}
                    </ChipButton>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-5 text-sm text-gray-600 hover:border-primary-400 hover:bg-primary-50">
              <ImageIcon size={16} />
              참고 이미지 첨부 (5MB 이하)
              <input
                type="file"
                accept="image/*"
                onChange={handleReferenceFile}
                className="hidden"
              />
            </label>
          )}
        </Field>

        {/* ── 고급 옵션 ──────────────────────────────────── */}
        <div className="rounded-lg border border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            <span>고급 옵션 (자유 키워드 · 텍스트 직접 그리기)</span>
            {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {advancedOpen && (
            <div className="space-y-4 border-t border-gray-200 px-3 py-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  자유 키워드
                </label>
                <input
                  type="text"
                  value={moodKeywords}
                  onChange={(e) => setMoodKeywords(e.target.value)}
                  maxLength={200}
                  placeholder="예: 배경에 작은 꽃잎이 흩날림 / 손글씨 느낌"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  위의 칩으로 못 다룬 디테일이 있으면 자유롭게 적어주세요.
                </p>
              </div>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={includeText}
                  onChange={(e) => setIncludeText(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  AI 가 한국어 텍스트도 디자인에 녹여 넣도록 요청
                  <span className="ml-1 text-xs text-gray-500">
                    (기본값. 체크 끄면 텍스트 없는 배경만 만들고 텍스트는 탭 ② 마무리에서 합성)
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:bg-gray-300"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {result ? "다시 생성" : "프롬프트 생성"}
        </button>
      </div>

      {/* ── 결과 ────────────────────────────────────────── */}
      {result && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">생성된 영문 프롬프트</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                title="다시 생성"
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                다시
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  copied
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-primary-600 text-white hover:bg-primary-700"
                }`}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "복사됨!" : "복사"}
              </button>
            </div>
          </div>

          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <span className="mr-1 font-medium text-gray-500">선택한 옵션:</span>
            {result.koreanSummary}
          </p>

          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
            {result.englishPrompt}
          </pre>

          {/* DALL-E 생성 버튼 및 결과 */}
          <div className="space-y-4 rounded-xl border border-primary-100 bg-primary-50/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-primary-900 flex items-center gap-1.5">
                <Wand2 size={16} />
                ChatGPT(DALL-E 3)로 바로 이미지 생성
              </h3>
              {!dalleImageUrl && (
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  disabled={generatingImage}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-700 disabled:bg-gray-300"
                >
                  {generatingImage ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {generatingImage ? "생성 중..." : "이미지 바로 만들기"}
                </button>
              )}
            </div>

            {dalleImageUrl ? (
              <div className="space-y-4">
                <div className="relative aspect-[3/4] max-w-sm mx-auto overflow-hidden rounded-lg border border-primary-200 shadow-md bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dalleImageUrl}
                    alt="DALL-E 생성 결과"
                    className="h-full w-full object-contain"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleFinishAndEdit}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Wand2 size={18} />
                    이 이미지로 마무리 작업 시작하기
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateImage}
                    disabled={generatingImage}
                    className="text-xs text-gray-500 hover:text-primary-600 underline underline-offset-4"
                  >
                    마음에 안 드나요? 다시 생성하기
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-600 leading-relaxed">
                영문 프롬프트를 복사해 직접 생성하는 대신, 버튼 하나로 이미지를 즉시 생성할 수 있습니다. 
                <br />
                <span className="text-[10px] text-gray-400 font-normal">
                  * OpenAI API를 사용하여 약 10~20초 정도 소요됩니다.
                </span>
              </p>
            )}
          </div>

          {resultRefPreview && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 text-xs font-semibold text-amber-900">
                💡 더 정확한 결과를 위해 — 이 참고 이미지도 ChatGPT/Gemini 채팅창에 함께 첨부하세요
              </p>
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultRefPreview}
                  alt="참고 이미지"
                  className="h-20 w-20 shrink-0 rounded-lg border border-amber-300 object-cover"
                />
                <div className="min-w-0 flex-1 text-xs text-amber-900">
                  <p>
                    이미지를 채팅창으로 끌어다 놓거나(드래그&amp;드롭) 첨부 버튼으로 올린 뒤
                    위의 영문 프롬프트를 함께 붙여넣으면, AI 가 텍스트 묘사 + 원본 이미지
                    둘 다 참조해서 더 정확한 결과를 만듭니다.
                  </p>
                  <a
                    href={resultRefPreview}
                    download={referenceFile?.name ?? "reference.jpg"}
                    className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    <Download size={12} />
                    참고 이미지 다운로드
                  </a>
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold text-gray-700">
              어디에 붙여넣을까요?
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {TARGET_TOOLS.map((t) => (
                <a
                  key={t.name}
                  href={t.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-primary-300 hover:bg-primary-50"
                >
                  <span className="flex items-center gap-1 text-sm font-medium text-gray-900">
                    {t.name}
                    <ExternalLink size={12} className="text-gray-400 group-hover:text-primary-600" />
                  </span>
                  <span className="text-xs text-gray-500">{t.hint}</span>
                </a>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            팁: 결과가 마음에 들지 않으면 칩을 바꾸거나 &lsquo;다시&rsquo; 버튼을 눌러
            다른 표현의 프롬프트를 받아볼 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-gray-700">
        <span>{label}</span>
        {hint && <span className="text-[10px] font-normal text-gray-400">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
        active
          ? "border-primary-600 bg-primary-50 text-primary-700"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}
