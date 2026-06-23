/**
 * 포스터 프롬프트 빌더 — 사용자가 자기 AI 도구(ChatGPT / Gemini / Midjourney 등)에
 * 붙여넣어 이미지를 생성할 수 있도록, **이미지 프롬프트 그 자체**를 작성하기 위한
 * **메타 프롬프트** 를 만든다.
 *
 * 흐름: 폼(칩 5종) → 메타 프롬프트 → Gemini 텍스트 API → 영문 이미지 프롬프트 → 사용자 복사
 *
 * docs/poster-generation-strategy.md 참조.
 */

export const POSTER_CATEGORIES = ["event", "welcome", "group", "notice", "custom"] as const;
export type PosterCategory = (typeof POSTER_CATEGORIES)[number];

export const POSTER_RATIOS = ["1:1", "9:16", "a4"] as const;
export type PosterRatio = (typeof POSTER_RATIOS)[number];

export const POSTER_CATEGORY_LABEL: Record<PosterCategory, string> = {
  event: "행사 포스터",
  welcome: "새가족 환영",
  group: "소모임 모집",
  notice: "공지",
  custom: "기타",
};

export const POSTER_RATIO_LABEL: Record<PosterRatio, string> = {
  "1:1": "정사각형 (인스타 피드 1:1)",
  "9:16": "세로 (인스타 스토리·릴스 9:16)",
  a4: "A4 세로 (인쇄용)",
};

/** 이미지 생성 AI 가 잘 이해하는 비율 표현 */
function ratioForAI(ratio: PosterRatio): string {
  switch (ratio) {
    case "1:1":
      return "square 1:1 aspect ratio (1080×1080)";
    case "9:16":
      return "vertical 9:16 aspect ratio (1080×1920, optimized for Instagram Story / Reels)";
    case "a4":
      return "A4 portrait paper ratio (approximately 1:1.41, 210×297mm)";
  }
}

// ─── 칩 프리셋 ──────────────────────────────────────────────

export const COLOR_PALETTES = [
  "springPastel",
  "coralPeach",
  "lavenderSage",
  "summerCool",
  "oceanTeal",
  "mintLemon",
  "duskyRose",
  "easterLily",
  "forestSage",
  "winterCobalt",
  "jewelTone",
  "dancheong",
  "christmasDeep",
  "autumnAmber",
  "navyIvory",
  "woodCream",
  "monochrome",
] as const;
export type ColorPalette = (typeof COLOR_PALETTES)[number];

export const COLOR_PALETTE_DEFS: Record<
  ColorPalette,
  { ko: string; en: string; swatch: [string, string, string] }
> = {
  springPastel: {
    ko: "봄 파스텔",
    en: "soft spring pastels with gentle pink, light green, and cream tones",
    swatch: ["#fce7e7", "#d4f0d4", "#fff8e7"],
  },
  coralPeach: {
    ko: "산호·복숭아",
    en: "vibrant coral pink, soft peach, and warm cream tones with a cheerful inviting feel",
    swatch: ["#ff7e6b", "#ffb494", "#fff5ec"],
  },
  lavenderSage: {
    ko: "라벤더·세이지",
    en: "calm lavender purple paired with soft sage green and ivory, gentle and contemplative",
    swatch: ["#c5b3e6", "#a8c4a0", "#f5f1e8"],
  },
  summerCool: {
    ko: "여름 청량",
    en: "cool summer palette with sky blue, fresh white, and mint accents",
    swatch: ["#bfe1ff", "#ffffff", "#cdf0e0"],
  },
  oceanTeal: {
    ko: "오션 틸",
    en: "fresh ocean teal with a coral pink accent and crisp aqua white, energetic and clean",
    swatch: ["#2a9d8f", "#ee6c4d", "#e8f3f1"],
  },
  mintLemon: {
    ko: "민트·레몬",
    en: "fresh mint green, soft lemon yellow, and clean white with a crisp youthful feel",
    swatch: ["#a8e6cf", "#fff2a0", "#ffffff"],
  },
  duskyRose: {
    ko: "더스티 로즈",
    en: "muted dusky rose pink with blush and warm soft grey, romantic and refined",
    swatch: ["#c08497", "#e8b4b8", "#d8c8c4"],
  },
  autumnAmber: {
    ko: "가을 앰버",
    en: "warm autumn palette with amber, terracotta, and earthy brown",
    swatch: ["#e8a85c", "#c66c3f", "#8b5a3c"],
  },
  winterCobalt: {
    ko: "겨울 코발트",
    en: "cool winter palette with cobalt blue, snow white, and silver",
    swatch: ["#1a3a8a", "#f5f8ff", "#c7cfdb"],
  },
  easterLily: {
    ko: "부활절 (백합·금색)",
    en: "easter palette featuring white lily, soft gold, and gentle lavender purple",
    swatch: ["#ffffff", "#e8c768", "#d8c3e8"],
  },
  forestSage: {
    ko: "포레스트 세이지",
    en: "deep forest green and soft sage with warm ivory, calm and natural with a sense of growth",
    swatch: ["#2d5f3f", "#8aa886", "#f5f1e8"],
  },
  jewelTone: {
    ko: "보석톤",
    en: "rich jewel tones with sapphire blue, emerald green, and ruby red on a soft ivory base",
    swatch: ["#1e40af", "#047857", "#9f1239"],
  },
  dancheong: {
    ko: "단청 (전통 채색)",
    en: "traditional Korean dancheong palette with vivid vermillion red, deep cobalt blue, and emerald green on an ivory base",
    swatch: ["#c0382b", "#1f4e79", "#0f7e3f"],
  },
  christmasDeep: {
    ko: "성탄 (딥레드·에메랄드)",
    en: "christmas palette with deep red, emerald green, and rich gold",
    swatch: ["#a8312f", "#1f6e4f", "#e8c768"],
  },
  navyIvory: {
    ko: "차분한 네이비·아이보리",
    en: "calm and trustworthy navy and ivory tones with subtle gold accents",
    swatch: ["#1e3a8a", "#fafaf6", "#c9a84c"],
  },
  woodCream: {
    ko: "따뜻한 우드·크림",
    en: "warm wood, kraft paper, and cream tones with soft caramel",
    swatch: ["#a87a4d", "#f5edda", "#d6c0a3"],
  },
  monochrome: {
    ko: "모던 모노크롬",
    en: "modern monochrome palette with deep charcoal, soft greys, and clean white",
    swatch: ["#111827", "#9ca3af", "#ffffff"],
  },
};

export const ART_STYLES = [
  "watercolor",
  "flatIllustration",
  "lineArt",
  "paperCut",
  "photoRealistic",
  "miniature3d",
  "pixelArt",
  "publicCampaign",
] as const;
export type ArtStyle = (typeof ART_STYLES)[number];

export const ART_STYLE_DEFS: Record<ArtStyle, { ko: string; en: string; sampleSrc: string }> = {
  watercolor: {
    ko: "수채화",
    en: "soft watercolor painting with gentle brush strokes, pigment bleed, and natural paper texture",
    sampleSrc: "/images/1Watercolor.jpg",
  },
  flatIllustration: {
    ko: "플랫 일러스트",
    en: "modern flat illustration with clean vector-like shapes, bold simple forms, and crisp editorial composition",
    sampleSrc: "/images/2flat.jpg",
  },
  lineArt: {
    ko: "손그림 라인아트",
    en: "delicate hand-drawn line art with sparse detail, warm handmade feeling, and lots of breathing space",
    sampleSrc: "/images/3line.jpg",
  },
  paperCut: {
    ko: "종이공예",
    en: "layered paper craft illustration with cut paper shapes, tactile depth, crisp edges, and soft shadows",
    sampleSrc: "/images/4paper.jpg",
  },
  photoRealistic: {
    ko: "사실적 사진",
    en: "realistic photography with natural lighting, documentary church event atmosphere, and subtle depth of field",
    sampleSrc: "/images/5photo.jpg",
  },
  miniature3d: {
    ko: "3D 미니어처",
    en: "cute 3D miniature diorama with toy-like scale, soft global illumination, and gentle isometric depth",
    sampleSrc: "/images/6miniature.jpg",
  },
  pixelArt: {
    ko: "픽셀아트",
    en: "clean pixel art poster style with crisp grid pixels, retro charm, readable simple silhouettes, and balanced spacing",
    sampleSrc: "/images/7pixel.jpg",
  },
  publicCampaign: {
    ko: "공익광고풍",
    en: "Korean public campaign poster style with clear symbolic visual, civic message tone, strong hierarchy, and polished print design",
    sampleSrc: "/images/8public.jpg",
  },
};

export const MOODS = [
  "warmWelcoming",
  "sereneReverent",
  "vibrantJoyful",
  "hopefulBright",
  "restrainedFormal",
] as const;
export type Mood = (typeof MOODS)[number];

export const MOOD_DEFS: Record<Mood, { ko: string; en: string }> = {
  warmWelcoming: { ko: "따뜻하고 환영하는", en: "warm, welcoming, and inviting" },
  sereneReverent: { ko: "고요하고 경건한", en: "serene, reverent, and contemplative" },
  vibrantJoyful: { ko: "활기차고 기쁜", en: "vibrant, joyful, and full of celebration" },
  hopefulBright: { ko: "희망차고 밝은", en: "hopeful and bright with a sense of new beginning" },
  restrainedFormal: { ko: "절제되고 공식적인", en: "restrained, dignified, and formal" },
};

export const MOTIFS = [
  "crossSilhouette",
  "openBible",
  "dove",
  "raysOfLight",
  "nature",
  "citySkyline",
  "candleLight",
  "abstractGeometric",
] as const;
export type Motif = (typeof MOTIFS)[number];

export const MOTIF_DEFS: Record<Motif, { ko: string; en: string }> = {
  crossSilhouette: { ko: "십자가 실루엣", en: "subtle cross silhouette in the background" },
  openBible: { ko: "펼쳐진 성경", en: "an open Bible with soft pages" },
  dove: { ko: "비둘기", en: "gentle dove silhouette in flight" },
  raysOfLight: { ko: "빛줄기", en: "soft rays of light streaming through the scene" },
  nature: { ko: "자연 (산·꽃·물)", en: "natural elements like mountains, flowers, water, or sky" },
  citySkyline: { ko: "도시 스카이라인", en: "minimal city skyline silhouette" },
  candleLight: { ko: "양초 빛", en: "warm candlelight glow" },
  abstractGeometric: { ko: "추상 기하", en: "abstract geometric shapes and gentle lines" },
};

export const PEOPLE_HANDLINGS = ["none", "silhouette", "abstract", "visible"] as const;
export type PeopleHandling = (typeof PEOPLE_HANDLINGS)[number];

export const PEOPLE_HANDLING_DEFS: Record<PeopleHandling, { ko: string; en: string }> = {
  none: { ko: "사람 없음", en: "absolutely no people in the image" },
  silhouette: {
    ko: "뒷모습 실루엣만",
    en: "only back-view or distant silhouettes of people, no visible faces",
  },
  abstract: {
    ko: "추상화된 사람들",
    en: "highly stylized abstract human figures with no realistic facial features",
  },
  visible: {
    ko: "사람 등장",
    en: "visible people appearing naturally in the scene, warm and respectful, without depicting any specific real person or religious figure",
  },
};

// ─── 참고 이미지 차용 측면 ─────────────────────────────────

export const REFERENCE_ASPECTS = ["style", "composition", "both"] as const;
export type ReferenceAspect = (typeof REFERENCE_ASPECTS)[number];

export const REFERENCE_ASPECT_DEFS: Record<ReferenceAspect, { ko: string; en: string }> = {
  style: {
    ko: "스타일·색감",
    en: "the artistic style, color palette, lighting, texture, and overall mood",
  },
  composition: {
    ko: "구도·레이아웃",
    en: "the composition, framing, spatial arrangement, and visual hierarchy",
  },
  both: {
    ko: "스타일과 구도 둘 다",
    en: "both the artistic style/colors and the composition/layout",
  },
};

// ─── 입력 타입 ──────────────────────────────────────────────

export interface PromptBuilderInput {
  category: PosterCategory;
  /** 포스터 핵심 제목/주제 (예: "2026 봄 부흥회") */
  title: string;

  // 구조화된 부가 정보 — AI 가 각 항목을 별도 시각 요소로 처리하도록 영문 라벨로 분리해 전달
  /** 일시 항목 — 회차마다 한 줄. AI 는 합치지 말고 각각의 시각 단위로 표현 */
  schedules: string[];
  /** 장소 (단일) */
  location?: string;
  /** 대상·주관·강사 — byline 형식 */
  audience?: string;
  /** 부가 정보 — 한 줄 = 한 항목 (등록 마감, 문의처 등) */
  extraLines?: string[];

  // 칩 5종
  colorPalette: ColorPalette;
  artStyle: ArtStyle;
  mood: Mood;
  motifs: Motif[];
  peopleHandling: PeopleHandling;
  /** 사람 표현이 none 이 아닐 때 원하는 인원 수 */
  peopleCount?: number;

  /** (고급) 자유 키워드. 비워두는 게 기본 */
  moodKeywords?: string;

  ratio: PosterRatio;
  /** true = AI 가 한국어 텍스트도 직접 그리도록 지시. false = 텍스트 없이 빈 공간 확보. */
  includeText: boolean;

  /** 참고 이미지가 첨부됐을 때, 어느 측면을 차용할지 */
  referenceAspect?: ReferenceAspect;
}

export const DEFAULT_PROMPT_INPUT: Pick<
  PromptBuilderInput,
  "colorPalette" | "artStyle" | "mood" | "motifs" | "peopleHandling" | "peopleCount"
> = {
  colorPalette: "springPastel",
  artStyle: "watercolor",
  mood: "warmWelcoming",
  motifs: ["raysOfLight"],
  peopleHandling: "none",
  peopleCount: 3,
};

// ─── 메타 프롬프트 빌더 ─────────────────────────────────────

/** 빈 항목 제거 + trim — UI 에서 비어 있는 row 가 메타 프롬프트로 새지 않게. */
function cleanList(arr: string[] | undefined): string[] {
  if (!arr) return [];
  return arr.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Gemini 텍스트 모델에게 보낼 메타 프롬프트.
 * 결과로 모델은 "사용자가 자기 AI 도구에 붙여넣을 영문 이미지 프롬프트" 한 덩어리를 반환한다.
 *
 * @param hasReferenceImage true 면 멀티모달 호출에 참고 이미지가 동봉됨 — Gemini 가
 *                          그 이미지를 함께 본다는 전제로 추가 지시 섹션이 포함됨.
 */
export function buildMetaPromptForGemini(
  input: PromptBuilderInput,
  imageContext: boolean | { hasStyleSampleImage?: boolean; hasUserReferenceImage?: boolean } = false,
): string {
  const hasUserReferenceImage =
    typeof imageContext === "boolean"
      ? imageContext
      : Boolean(imageContext.hasUserReferenceImage);
  const hasStyleSampleImage =
    typeof imageContext === "boolean"
      ? false
      : Boolean(imageContext.hasStyleSampleImage);
  const categoryLabel = POSTER_CATEGORY_LABEL[input.category];
  const aiRatio = ratioForAI(input.ratio);

  const schedules = cleanList(input.schedules);
  const extraLines = cleanList(input.extraLines);
  const location = input.location?.trim() || "";
  const audience = input.audience?.trim() || "";

  const motifsEn =
    input.motifs.length > 0
      ? input.motifs.map((m) => MOTIF_DEFS[m].en).join("; ")
      : "no specific symbolic motif";

  // [입력] 블록 — 비어있는 필드는 자동 생략
  const inputBlocks: string[] = [
    `- 종류: ${categoryLabel}`,
    `- 제목: ${input.title}`,
  ];
  if (schedules.length > 0) {
    inputBlocks.push(
      `- Schedule entries — these are MULTIPLE distinct occurrences. Treat each as its own visual unit; NEVER merge them into a single comma-separated sentence:\n${schedules
        .map((s) => `    • "${s}"`)
        .join("\n")}`,
    );
  }
  if (location) inputBlocks.push(`- Location: "${location}"`);
  if (audience) inputBlocks.push(`- Audience / host / speaker: "${audience}"`);
  if (extraLines.length > 0) {
    inputBlocks.push(
      `- Additional info — each line is an INDEPENDENT fact. Render each as its own visual element (badge, info chip, list row), never concatenated:\n${extraLines
        .map((l) => `    • "${l}"`)
        .join("\n")}`,
    );
  }
  inputBlocks.push(`- Color palette: ${COLOR_PALETTE_DEFS[input.colorPalette].en}`);
  inputBlocks.push(`- Art style: ${ART_STYLE_DEFS[input.artStyle].en}`);
  inputBlocks.push(`- Mood: ${MOOD_DEFS[input.mood].en}`);
  inputBlocks.push(`- Visual motifs to include: ${motifsEn}`);
  inputBlocks.push(`- Human figures: ${PEOPLE_HANDLING_DEFS[input.peopleHandling].en}`);
  if (input.peopleHandling !== "none" && input.peopleCount) {
    inputBlocks.push(
      `- Desired number of human figures: approximately ${input.peopleCount}. Keep all people above the reserved footer band.`,
    );
  }
  if (input.moodKeywords?.trim()) {
    inputBlocks.push(`- Additional user keywords: ${input.moodKeywords.trim()}`);
  }
  inputBlocks.push(`- Aspect ratio: ${aiRatio}`);

  // 텍스트 처리 지시
  const textInstruction = input.includeText
    ? `사용자는 AI 가 한국어 텍스트도 이미지 안에 직접 그려주길 원합니다. 영문 프롬프트 작성 시 다음을 모두 반영하세요.

- 제목 "${input.title}" 은 포스터에서 가장 눈에 띄는 위치/크기로 배치하도록 명시 (영문 프롬프트 안에 큰따옴표로 정확한 한국어 원문 포함).
${
  schedules.length > 0
    ? `- Schedule entries 는 줄글로 합치면 안 됨. 영문 프롬프트에 다음과 같이 명시하세요: "Render each Korean schedule entry as its OWN visual unit — for example as a stacked vertical list, a calendar grid, day-of-week badges, or a weekly schedule card. Do NOT merge them into one sentence." 그리고 각 schedule 한국어 원문을 큰따옴표로 정확히 포함시키세요.`
    : ""
}
${
  location
    ? `- Location 은 작은 캡션 + 위치 핀 아이콘 또는 인포 바로 처리하라고 명시. 한국어 원문 큰따옴표 정확 포함.`
    : ""
}
${
  audience
    ? `- Audience/host/speaker 는 byline 형식 (작고 부수적, credit line 느낌). 한국어 원문 큰따옴표 정확 포함.`
    : ""
}
${
  extraLines.length > 0
    ? `- Additional info 의 각 줄은 독립된 작은 배지/인포칩/리스트 row 로 처리하라고 명시. 절대 한 문장으로 합치지 말 것. 각 한국어 원문 큰따옴표 정확 포함.`
    : ""
}
- 모든 한국어 원문은 영문 프롬프트 안에 **큰따옴표로 정확히** 포함되어야 함 (오타·재해석 금지).
- "render Korean text crisply with proper hangul typography" 명시.
- "if Korean rendering fails, leave clearly defined empty zones in matching positions so the user can add text manually" fallback 명시.
- 모든 한국어 텍스트(제목·일시·장소·정보)는 **하단 약 14% 영역을 침범하지 않도록** 그 위쪽에만 배치하라고 명시.`
    : `사용자는 AI 가 텍스트를 그리지 않기를 원합니다 (한국어 텍스트는 따로 합성). 영문 프롬프트에 다음을 명시하세요.

- "absolutely no text, no letters, no numbers, no logos in the image".
- 빈 공간을 의도적으로 확보: 상단(제목 자리), 일정 표시 영역(${schedules.length > 0 ? "여러 회차 — 세로 리스트나 캘린더 형식 자리" : "필요시 1줄"}), 위치/대상/부가정보 자리(${location || audience || extraLines.length > 0 ? "각각 별도 배지/인포 영역" : "필요시"}).
- "make the empty zones clearly defined so the user can overlay Korean text afterwards."`;

  // 참고 이미지가 함께 첨부됐을 때 추가 지시
  const aspect = input.referenceAspect ?? "style";
  const styleSampleSection = hasStyleSampleImage
    ? `

[내장 그림체 샘플 이미지]
선택한 그림체 "${ART_STYLE_DEFS[input.artStyle].ko}" 의 샘플 이미지가 이 메시지의 첫 번째 inlineData 로 동봉되어 있습니다. 이 이미지는 최종 포스터의 **그림체 참고용**입니다.

차용 규칙:
- 브러시 느낌, 질감, 색 처리, 조명, 깊이감, 형태 단순화 방식 같은 **추상적 스타일 특성만** 참고하세요.
- 샘플 이미지의 텍스트, 로고, 인물, 고유 캐릭터, 고유 사물 배치는 복제하지 마세요.
- 결과 프롬프트에는 선택한 교회 행사 정보가 우선이며, 샘플은 "style reference" 로만 자연스럽게 녹입니다.
`
    : "";
  const userReferenceSection = hasUserReferenceImage
    ? `

[사용자 참고 이미지]
사용자가 참고 이미지 1장을 함께 첨부했습니다${hasStyleSampleImage ? " (이 메시지의 두 번째 inlineData)" : " (이 메시지의 inlineData)"}. 이 이미지의 ${REFERENCE_ASPECT_DEFS[aspect].en} 를 분석한 뒤, 결과 영문 프롬프트에 자연스럽게 녹여 주세요.

차용 규칙:
- 색조·라이팅·질감·분위기·구도 같은 **추상적 미적 요소만** 가져옴.
- **인물 얼굴·로고·텍스트·고유 캐릭터·구체적 사물의 모양** 은 절대 복제하지 마세요. 저작권/초상권 회피.
- 영문 프롬프트 안에 한 두 문장 정도, 예) "in a gentle watercolor mood reminiscent of the reference image, with similar warm pastel hues and soft diffused lighting" 같은 식으로 자연스럽게 통합.
- 참고 이미지 자체가 부적절(폭력·성인 등) 하면 그 부분은 무시하고 위 [입력] 만으로 작성.
`
    : "";
  const referenceSection = `${styleSampleSection}${userReferenceSection}`;

  return `당신은 이미지 생성 AI(ChatGPT image generation, Gemini, Midjourney, DALL·E 등) 에 입력할 영문 프롬프트를 작성하는 전문가입니다.

한국 개신교 교회의 ${categoryLabel} 용 이미지를 만들고자 합니다. 사용자가 선택한 요소는 다음과 같습니다.

[입력]
${inputBlocks.join("\n")}
${referenceSection}
[작성 요구사항]
1. 위 요소들을 자연스러운 영문 산문체로 엮어 한국 교회 분위기에 어울리는 영문 이미지 프롬프트를 작성하세요.
2. ${textInstruction}
3. **하단 푸터 공간 필수 확보** — 생성된 이미지 위에 교회 푸터(로고·전화·주소·QR)를 후합성합니다. 영문 프롬프트에 반드시 다음 취지를 명확히 포함하세요:
   "Reserve the bottom 14% of the canvas as completely empty space (or only soft, low-contrast background gradient). Do NOT place any subject, focal element, face, important detail, text, or logo within this bottom 14% — this strip is reserved for a footer overlay added in post-production. The composition's center of interest must sit clearly above this reserved bottom band."
4. 비율은 반드시 프롬프트에 포함: "${aiRatio}".
5. 다음은 절대 포함하지 마세요:
   - 묘비, 무덤 위 십자가
   - 어둡거나 음울한 톤 (사용자가 명시적으로 요청하지 않은 경우)
   - 특정 종교 인물(예수·성인) 의 구체적 얼굴 묘사
   - 사용자가 "사람 없음" 을 선택했는데 사람을 그리는 것
6. 컴포지션·조명·질감 정보를 풍부하게 담으세요.
7. 길이: 100~220 단어. 한 문단 또는 두 문단으로.
8. ChatGPT·Gemini·Midjourney 어디든 그대로 붙여넣을 수 있는 자연스러운 영문 산문체.
9. **출력은 영문 프롬프트 본문만**. 다음을 절대 출력하지 마세요:
   - 마크다운 (**, ##, - 등)
   - 따옴표로 감싸기
   - "Here's the prompt:" 같은 머리말
   - 프롬프트 앞뒤 설명·해설

이제 영문 프롬프트만 출력하세요.`;
}

/**
 * 결과 화면용 짧은 한국어 요약. 사용자가 어떤 톤으로 만들어달라고 부탁하는지 한눈에 보도록.
 * Gemini 호출 없이 입력값만으로 만든다.
 */
export function buildKoreanSummary(input: PromptBuilderInput): string {
  const parts: string[] = [];
  parts.push(POSTER_CATEGORY_LABEL[input.category]);
  parts.push(`"${input.title}"`);

  const schedules = cleanList(input.schedules);
  if (schedules.length > 0) parts.push(`일시: ${schedules.join(" / ")}`);
  if (input.location?.trim()) parts.push(`장소: ${input.location.trim()}`);
  if (input.audience?.trim()) parts.push(`대상: ${input.audience.trim()}`);
  const extras = cleanList(input.extraLines);
  if (extras.length > 0) parts.push(`정보: ${extras.join(" / ")}`);

  parts.push(COLOR_PALETTE_DEFS[input.colorPalette].ko);
  parts.push(ART_STYLE_DEFS[input.artStyle].ko);
  parts.push(MOOD_DEFS[input.mood].ko);
  if (input.motifs.length > 0) {
    parts.push(input.motifs.map((m) => MOTIF_DEFS[m].ko).join("·"));
  }
  parts.push(PEOPLE_HANDLING_DEFS[input.peopleHandling].ko);
  if (input.peopleHandling !== "none" && input.peopleCount) {
    parts.push(`사람 수: ${input.peopleCount}명`);
  }
  if (input.moodKeywords) parts.push(`키워드: ${input.moodKeywords}`);
  parts.push(POSTER_RATIO_LABEL[input.ratio]);
  parts.push(input.includeText ? "AI 가 한국어 텍스트 디자인 통합" : "텍스트는 따로 합성");
  if (input.referenceAspect) {
    parts.push(`참고 이미지: ${REFERENCE_ASPECT_DEFS[input.referenceAspect].ko}`);
  }
  return parts.join(" · ");
}
