"use client";

import { useEffect, useState, useRef } from "react";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Image as ImageIcon,
  Wand2,
  Layout,
  Type,
  Palette,
  Eye,
  type LucideIcon,
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
import { cn } from "@/lib/utils";

interface BuildPromptResponse {
  englishPrompt: string;
  koreanSummary: string;
  error?: string;
}

interface GenerateImageResponse {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  revisedPrompt?: string;
  error?: string;
}

interface GeneratedPosterImage {
  id: string;
  imageUrl: string;
  source: "generate" | "revise";
  instruction?: string;
  createdAt: number;
}

const QUICK_REVISION_CHIPS: { label: string; instruction: string }[] = [
  {
    label: "더 밝게",
    instruction: "Make the overall image brighter, cleaner, and more uplifting.",
  },
  {
    label: "더 따뜻하게",
    instruction: "Make the mood warmer, more welcoming, and more pastoral.",
  },
  {
    label: "더 단순하게",
    instruction: "Simplify the composition and reduce visual clutter while keeping the main idea.",
  },
  {
    label: "인물 제거",
    instruction: "Remove all people and faces. Use symbolic or environmental elements instead.",
  },
  {
    label: "텍스트 제거",
    instruction: "Remove all visible text, letters, numbers, logos, and watermark-like marks.",
  },
  {
    label: "footer 공간 확보",
    instruction:
      "Reserve more clear empty space at the bottom for the church footer. Do not place any subject, text, face, or important detail in the bottom band.",
  },
  {
    label: "교회 행사 느낌",
    instruction:
      "Make it feel more like a polished Korean church event poster, warm and appropriate for a congregation.",
  },
  {
    label: "배경 덜 복잡하게",
    instruction: "Make the background less busy and keep more calm open space.",
  },
];

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
  const [peopleCount, setPeopleCount] = useState(DEFAULT_PROMPT_INPUT.peopleCount ?? 3);

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

  const resultRef = useRef<HTMLDivElement>(null);

  // GPT 이미지 직접 생성/수정 관련
  const [generatingImage, setGeneratingImage] = useState(false);
  const [dalleImageUrl, setDalleImageUrl] = useState<string | null>(null);
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [imageHistory, setImageHistory] = useState<GeneratedPosterImage[]>([]);

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
  function updatePeopleCount(value: number) {
    setPeopleCount(Math.max(1, Math.min(30, Math.round(value || 1))));
  }

  async function handleGenerate() {
    if (!title.trim()) {
      alert("제목을 입력해 주세요.");
      return;
    }
    setLoading(true);
    setCopied(false);
    setDalleImageUrl(null); // 새 프롬프트 뽑으면 이전 생성 결과 리셋
    setRevisionInstruction("");
    setImageHistory([]);
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
        peopleCount: peopleHandling === "none" ? undefined : peopleCount,
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

      // 생성 후 결과창으로 스크롤
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      console.error(e);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateImage(
    mode: "generate" | "revise" = "generate",
    instructionOverride?: string,
  ) {
    if (!result?.englishPrompt) return;
    const instruction = (instructionOverride ?? revisionInstruction).trim();
    if (mode === "revise" && !dalleImageUrl) {
      alert("먼저 수정할 이미지를 생성해 주세요.");
      return;
    }
    if (mode === "revise" && !instruction) {
      alert("수정 요청을 입력해 주세요.");
      return;
    }

    setGeneratingImage(true);
    try {
      const r = await fetch("/api/posters/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: result.englishPrompt,
          ratio: ratio,
          artStyle,
          mode,
          revisionInstruction: mode === "revise" ? instruction : undefined,
          sourceImageDataUrl: mode === "revise" ? dalleImageUrl : undefined,
        }),
      });
      const data = (await r.json()) as GenerateImageResponse;
      if (!r.ok) {
        alert(data.error ?? "이미지 생성 실패");
        return;
      }
      if (!data.imageUrl) {
        alert("이미지 데이터를 받지 못했습니다.");
        return;
      }
      setDalleImageUrl(data.imageUrl);
      setImageHistory((prev) => [
        {
          id: `${Date.now()}-${prev.length}`,
          imageUrl: data.imageUrl!,
          source: mode,
          instruction: mode === "revise" ? instruction : undefined,
          createdAt: Date.now(),
        },
        ...prev,
      ]);
      if (mode === "revise") setRevisionInstruction("");
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
    const cleanedExtraLines = extraInfoText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const bodyParts: string[] = [];
    if (cleanedSchedules.length > 0) bodyParts.push(cleanedSchedules.join(" / "));
    if (location.trim()) bodyParts.push(location.trim());
    if (audience.trim()) bodyParts.push(audience.trim());

    onTransfer({
      ratio,
      title: title.trim(),
      bodyText: bodyParts.join("\n"),
      imageUrl: dalleImageUrl,
      fullInput: {
        category,
        title,
        schedules: cleanedSchedules,
        location,
        audience,
        extraLines: cleanedExtraLines.length > 0 ? cleanedExtraLines : undefined,
        colorPalette,
        artStyle,
        mood,
        motifs,
        peopleHandling,
        peopleCount: peopleHandling === "none" ? undefined : peopleCount,
        moodKeywords,
        ratio,
        includeText,
      },
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
    <div className="relative pb-24 lg:pb-0">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* ── 섹션 1: 기본 정보 ──────────────────────────────── */}
        <Section title="기본 설정" icon={Layout}>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="카테고리">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {POSTER_CATEGORIES.map((c) => (
                  <ChipButton key={c} active={category === c} onClick={() => setCategory(c)}>
                    {POSTER_CATEGORY_LABEL[c]}
                  </ChipButton>
                ))}
              </div>
            </Field>

            <Field label="포스터 비율">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {POSTER_RATIOS.map((r) => (
                  <ChipButton key={r} active={ratio === r} onClick={() => setRatio(r)}>
                    {POSTER_RATIO_LABEL[r]}
                  </ChipButton>
                ))}
              </div>
            </Field>
          </div>

          <Field label="메인 제목 (필수)">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="예: 2026 봄 부흥회"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 sm:text-sm"
            />
          </Field>
        </Section>

        {/* ── 섹션 2: 상세 내용 ──────────────────────────────── */}
        <Section title="상세 내용" icon={Type}>
          <Field
            label="📅 일시"
            hint="회차마다 한 줄씩 입력해 주세요. AI 가 각 항목을 시각화합니다."
          >
            <div className="space-y-3">
              {schedules.map((s, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={s}
                    onChange={(e) => updateSchedule(idx, e.target.value)}
                    maxLength={120}
                    placeholder={
                      idx === 0 ? "예: 6/15(월) 저녁 8시" : "예: 6/16(화) 저녁 7시 30분"
                    }
                    className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none sm:py-2 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeScheduleRow(idx)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:bg-rose-50 hover:text-rose-600 sm:h-9 sm:w-9"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addScheduleRow}
                disabled={schedules.length >= 20}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 sm:py-2 sm:text-xs"
              >
                <Plus size={14} />
                일시 추가
              </button>
            </div>
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="📍 장소">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={120}
                placeholder="예: 본당 / 교육관 2층"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none sm:py-2 sm:text-sm"
              />
            </Field>

            <Field label="🎤 대상 / 주관 / 강사">
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                maxLength={120}
                placeholder="예: 전 교인 / 청년부 주관"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none sm:py-2 sm:text-sm"
              />
            </Field>
          </div>

          <Field
            label="📝 부가 정보"
            hint="배지로 강조하고 싶은 항목을 한 줄에 하나씩 적어주세요."
          >
            <textarea
              value={extraInfoText}
              onChange={(e) => setExtraInfoText(e.target.value)}
              rows={3}
              placeholder={"예:\n등록: 5월 3일까지\n문의: 02-534-0691\n자율 헌금"}
              className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none sm:text-sm"
            />
          </Field>
        </Section>

        {/* ── 섹션 3: 디자인 스타일 ──────────────────────────── */}
        <Section title="디자인 스타일" icon={Palette}>
          <Field label="🎨 색감">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {COLOR_PALETTES.map((c) => {
                const def = COLOR_PALETTE_DEFS[c];
                return (
                  <ChipButton
                    key={c}
                    active={colorPalette === c}
                    onClick={() => setColorPalette(c)}
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="truncate">{def.ko}</span>
                      <span className="flex shrink-0 gap-0.5">
                        {def.swatch.map((sw, i) => (
                          <span
                            key={i}
                            className="h-3 w-3 rounded-full ring-1 ring-black/5"
                            style={{ backgroundColor: sw }}
                          />
                        ))}
                      </span>
                    </div>
                  </ChipButton>
                );
              })}
            </div>
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="🖌 그림체">
              <div className="grid grid-cols-2 gap-3">
                {ART_STYLES.map((s) => {
                  const def = ART_STYLE_DEFS[s];
                  const active = artStyle === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setArtStyle(s)}
                      className={cn(
                        "overflow-hidden rounded-xl border bg-white text-left transition-all active:scale-[0.99]",
                        active
                          ? "border-primary-600 shadow-sm ring-2 ring-primary-500"
                          : "border-gray-200 hover:border-gray-300 hover:shadow-sm",
                      )}
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={def.sampleSrc}
                          alt={`${def.ko} 샘플`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex min-h-[44px] items-center justify-between gap-2 px-3 py-2">
                        <span className="text-sm font-semibold text-gray-900">{def.ko}</span>
                        {active && <Check size={16} className="shrink-0 text-primary-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="🌟 분위기">
              <div className="grid grid-cols-2 gap-2">
                {MOODS.map((m) => (
                  <ChipButton key={m} active={mood === m} onClick={() => setMood(m)}>
                    {MOOD_DEFS[m].ko}
                  </ChipButton>
                ))}
              </div>
            </Field>
          </div>

          <Field label="🌸 시각 모티프 (다중 선택 가능)">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MOTIFS.map((m) => (
                <ChipButton key={m} active={motifs.includes(m)} onClick={() => toggleMotif(m)}>
                  {MOTIF_DEFS[m].ko}
                </ChipButton>
              ))}
            </div>
          </Field>

          <Field label="👥 사람 표현">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
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

          {peopleHandling !== "none" && (
            <Field label="사람 수" hint="포스터에 등장시키고 싶은 대략적인 인원 수입니다.">
              <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4 sm:flex-row sm:items-center">
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={peopleCount}
                  onChange={(e) => updatePeopleCount(Number(e.target.value))}
                  className="w-full accent-primary-600"
                />
                <div className="flex items-center gap-2 sm:w-32">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={peopleCount}
                    onChange={(e) => updatePeopleCount(Number(e.target.value))}
                    className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-primary-500 focus:outline-none"
                  />
                  <span className="text-sm font-medium text-gray-600">명</span>
                </div>
              </div>
            </Field>
          )}

          {/* 고급 옵션 */}
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50/50">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-gray-700"
            >
              <span>고급 옵션 (자유 키워드)</span>
              {advancedOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {advancedOpen && (
              <div className="space-y-4 border-t border-gray-100 p-4">
                <Field label="자유 키워드 추가">
                  <input
                    type="text"
                    value={moodKeywords}
                    onChange={(e) => setMoodKeywords(e.target.value)}
                    placeholder="예: 꽃잎이 흩날림 / 손글씨 느낌"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </Field>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-3">
                  <input
                    type="checkbox"
                    checked={includeText}
                    onChange={(e) => setIncludeText(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">
                      이미지에 한국어 텍스트 포함
                    </span>
                    <span className="text-xs text-gray-500">
                      AI 가 디자인에 직접 제목을 그려 넣도록 요청합니다.
                    </span>
                  </div>
                </label>
              </div>
            )}
          </div>
        </Section>

        {/* ── 섹션 4: 참고 이미지 ──────────────────────────── */}
        <Section title="참고 자료" icon={Eye}>
          <Field label="🖼 참고 이미지 (선택)" hint="원하는 구도나 분위기의 이미지를 첨부해 보세요.">
            {referencePreview ? (
              <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={referencePreview}
                    alt="참고 이미지"
                    className="h-20 w-20 rounded-lg object-cover shadow-sm ring-1 ring-black/5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {referenceFile?.name}
                    </p>
                    <button
                      onClick={clearReference}
                      className="mt-1 text-xs font-bold text-rose-600 hover:underline"
                    >
                      이미지 삭제
                    </button>
                  </div>
                </div>
                <Field label="참고 측면">
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
                </Field>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 py-10 transition-colors hover:border-primary-400 hover:bg-primary-50">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <ImageIcon size={24} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-900">이미지 업로드</p>
                  <p className="mt-0.5 text-xs text-gray-500">5MB 이하의 이미지 파일</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReferenceFile}
                  className="hidden"
                />
              </label>
            )}
          </Field>
        </Section>

        <div className="hidden lg:block">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 py-4 text-base font-bold text-white shadow-lg transition-transform hover:bg-primary-700 active:scale-[0.98] disabled:bg-gray-300"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
            {result ? "프롬프트 다시 만들기" : "영문 프롬프트 생성하기"}
          </button>
        </div>

        {/* ── 결과 영역 ──────────────────────────────────────── */}
        <div ref={resultRef} className="scroll-mt-6 space-y-6">
          {result && (
            <div className="space-y-6 rounded-2xl border border-primary-100 bg-white p-5 shadow-lg sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold text-gray-900">영문 프롬프트 결과</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-all sm:flex-none",
                      copied
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-primary-600 text-white hover:bg-primary-700"
                    )}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "복사완료" : "프롬프트 복사"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <Palette size={12} />
                  설정 요약
                </div>
                <p className="text-sm font-medium text-gray-700 leading-relaxed">
                  {result.koreanSummary}
                </p>
              </div>

              <div className="relative group">
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-gray-200 bg-slate-900 p-5 font-mono text-sm leading-relaxed text-slate-100">
                  {result.englishPrompt}
                </pre>
              </div>

              {/* GPT 이미지 생성/수정 카드 */}
              <div className="overflow-hidden rounded-2xl border-2 border-primary-100 bg-primary-50/20">
                <div className="bg-primary-600 p-4 text-white">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <Wand2 size={18} />
                    GPT 이미지 바로 생성
                  </h3>
                </div>
                <div className="p-5 sm:p-8">
                  {dalleImageUrl ? (
                    <div className="flex flex-col items-center gap-6">
                      <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={dalleImageUrl} alt="GPT 이미지 결과" className="h-full w-full object-contain" />
                      </div>
                      <div className="w-full space-y-3">
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
                            수정 요청
                          </label>
                          <textarea
                            value={revisionInstruction}
                            onChange={(e) => setRevisionInstruction(e.target.value)}
                            rows={3}
                            placeholder="예: 하단 footer 공간을 더 비우고 전체 톤을 더 밝고 따뜻하게 해줘"
                            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            {QUICK_REVISION_CHIPS.map((chip) => (
                              <button
                                key={chip.label}
                                type="button"
                                onClick={() => setRevisionInstruction(chip.instruction)}
                                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleGenerateImage("revise")}
                            disabled={generatingImage || !revisionInstruction.trim()}
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:bg-gray-300"
                          >
                            {generatingImage ? (
                              <Loader2 className="animate-spin" size={18} />
                            ) : (
                              <Wand2 size={18} />
                            )}
                            수정해서 다시 만들기
                          </button>
                        </div>
                        {imageHistory.length > 1 && (
                          <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                              이전 결과
                            </p>
                            <div className="grid grid-cols-4 gap-2">
                              {imageHistory.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setDalleImageUrl(item.imageUrl)}
                                  title={item.instruction || "초안 생성"}
                                  className={cn(
                                    "aspect-square overflow-hidden rounded-lg border bg-gray-100",
                                    item.imageUrl === dalleImageUrl
                                      ? "border-primary-600 ring-2 ring-primary-500"
                                      : "border-gray-200 hover:border-gray-300",
                                  )}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={item.imageUrl}
                                    alt={item.source === "revise" ? "수정 결과" : "생성 결과"}
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          onClick={handleFinishAndEdit}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-base font-bold text-white shadow-md hover:bg-emerald-700"
                        >
                          <Wand2 size={20} />
                          이 이미지로 마무리 작업하기
                        </button>
                        <button
                          onClick={() => handleGenerateImage("generate")}
                          disabled={generatingImage}
                          className="w-full text-sm font-bold text-gray-500 hover:text-primary-600"
                        >
                          같은 조건으로 다시 생성하기
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        영문 프롬프트를 복사해 직접 생성하는 대신,<br/>
                        버튼 클릭 한 번으로 즉시 고화질 포스터를 생성할 수 있습니다.
                      </p>
                      <button
                        onClick={() => handleGenerateImage("generate")}
                        disabled={generatingImage}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-4 text-base font-bold text-white shadow-md hover:bg-primary-700 sm:w-auto sm:px-10"
                      >
                        {generatingImage ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                        {generatingImage ? "이미지 생성 중..." : "이미지 바로 만들기"}
                      </button>
                      <p className="text-[10px] text-gray-400">
                        * 선택한 그림체 샘플을 참고해 GPT 이미지 API로 생성합니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 외부 도구 가이드 */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">외부 도구 활용</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TARGET_TOOLS.map((t) => (
                    <a
                      key={t.name}
                      href={t.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-primary-300 hover:shadow-md"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                        {t.name}
                        <ExternalLink size={12} className="text-gray-400" />
                      </span>
                      <span className="text-xs text-gray-500 leading-tight">{t.hint}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 모바일 하단 플로팅 버튼 (AdminBottomTabBar 위로) */}
      <div className="fixed bottom-14 inset-x-0 z-30 flex items-center justify-center p-4 lg:hidden">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 text-base font-bold text-white shadow-2xl transition-transform active:scale-95 disabled:bg-gray-300"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
          {result ? "프롬프트 다시 만들기" : "포스터 프롬프트 생성"}
        </button>
      </div>
    </div>
  );
}

// ── 컴포넌트 ───────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2 border-b border-gray-50 bg-gray-50/50 px-5 py-3">
        <Icon size={16} className="text-primary-600" />
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-6 p-5 sm:p-6">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-0.5">
        <label className="text-sm font-bold text-gray-900">{label}</label>
        {hint && <p className="text-xs text-gray-500 leading-relaxed">{hint}</p>}
      </div>
      <div className="relative">{children}</div>
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
      className={cn(
        "flex min-h-[44px] w-full items-center justify-center rounded-xl border px-3 py-2 text-center text-sm font-medium transition-all sm:min-h-[36px]",
        active
          ? "border-primary-600 bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-600"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 active:bg-gray-50"
      )}
    >
      {children}
    </button>
  );
}
