"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

type Placement = "top" | "bottom" | "left" | "right" | "center";

type Step = {
  path: string;
  selector?: string;
  title: string;
  body: string;
  placement?: Placement;
  /** 진입 시 타깃을 클릭 (탭 전환 등 — 패널 내용까지 함께 보이도록) */
  clickOnEnter?: boolean;
};

const STEPS: Step[] = [
  {
    path: "/admin",
    title: "관리자 대시보드",
    body: "여기서 처리 대기, 빠른 작성, 최근 활동을 한눈에 보고 각 영역으로 진입할 수 있습니다.",
    placement: "center",
  },
  {
    path: "/admin/menu",
    selector: "[data-tour='nav-notices']",
    title: "공지사항 메뉴",
    body: "데스크톱에선 좌측 사이드바, 모바일에선 하단 \"더보기 → 공지사항\" 으로 진입합니다.",
    placement: "right",
  },
  {
    path: "/admin/notices",
    selector: "[data-tour='notice-new']",
    title: "공지 작성",
    body: "이 버튼으로 새 공지를 만듭니다. 카테고리·제목·내용을 입력하면 비공개 상태로 저장됩니다.",
    placement: "bottom",
  },
  {
    path: "/admin/notices",
    selector: "[data-tour='notice-publish']",
    title: "공개 처리",
    body: "이 뱃지를 클릭하면 비공개 ↔ 공개가 토글됩니다. 공개로 바꾸면 메인 히어로 슬라이더에 즉시 노출됩니다.",
    placement: "left",
  },
  {
    path: "/admin/menu",
    selector: "[data-tour='nav-gallery']",
    title: "갤러리 메뉴",
    body: "사진 앨범은 여기서 관리합니다. 모바일 하단탭의 \"갤러리\" 로도 바로 접근 가능합니다.",
    placement: "right",
  },
  {
    path: "/admin/gallery",
    selector: "[data-tour='gallery-new']",
    title: "앨범 만들기",
    body: "갤러리는 앨범 단위로 묶입니다. 카테고리·날짜를 입력해 비어있는 앨범을 먼저 만드세요.",
    placement: "bottom",
  },
  {
    path: "/admin/gallery",
    selector: "[data-tour='gallery-upload']",
    title: "사진 추가",
    body: "여러 장을 한 번에 업로드할 수 있습니다. 큰 사진은 자동 압축되며, HEIC는 지원하지 않습니다.",
    placement: "left",
  },
  {
    path: "/admin/menu",
    selector: "[data-tour='nav-weeklies']",
    title: "주보 메뉴",
    body: "주간 주보 작성·발행은 여기서. 모바일 하단탭의 \"주보\" 로도 진입할 수 있습니다.",
    placement: "right",
  },
  {
    path: "/admin/weeklies",
    selector: "[data-tour='weekly-new']",
    title: "새 주보 작성",
    body: "지난 주보의 내용이 자동으로 채워진 상태로 시작합니다. 변경된 부분만 수정해 발행하면 인쇄·웹·알림톡까지 한 번에 반영됩니다.",
    placement: "bottom",
  },
  {
    path: "/admin/weeklies/new",
    selector: "[data-tour='weekly-tab-basic']",
    title: "주보 폼 — 6개 탭",
    body: "기본 / 페이지1·2·3·4 / 주보 마스터 6개 탭으로 구성됩니다. 우측엔 실시간 미리보기. 페이지별 입력은 직접 둘러보시고, 자주 헷갈리는 \"주보 마스터\" 만 짚어드립니다.",
    placement: "bottom",
    clickOnEnter: true,
  },
  {
    path: "/admin/weeklies/new",
    selector: "[data-tour='weekly-tab-masters']",
    title: "주보 마스터",
    body: "매주 안 바뀌는 공용값(섬기는분들·후원하는분들·목장·표어·기도제목)을 인라인으로 바로 수정. 손대지 않으면 그 다음 주에도 그대로 유지됩니다.",
    placement: "bottom",
    clickOnEnter: true,
  },
  {
    path: "/admin/menu",
    selector: "[data-tour='nav-posters']",
    title: "포스터 도구 메뉴",
    body: "AI 포스터 빌더 + 이미지 마무리 합성기가 여기 있습니다.",
    placement: "right",
  },
  {
    path: "/admin/posters",
    selector: "[data-tour='poster-prompt-tab']",
    title: "포스터 ① 프롬프트 만들기",
    body: "행사 정보·색감·스타일 등을 칩으로 고르면 영문 이미지 프롬프트가 자동 생성됩니다. 복사해 ChatGPT·Gemini·Midjourney에 붙여 이미지를 만드세요.",
    placement: "bottom",
    clickOnEnter: true,
  },
  {
    path: "/admin/posters",
    selector: "[data-tour='poster-finalize-tab']",
    title: "포스터 ② 이미지 마무리",
    body: "AI가 만든 이미지를 업로드하면 한글 제목·교회 푸터(로고·전화·QR)를 합성해 인스타·인쇄용 PNG로 다운로드할 수 있습니다.",
    placement: "bottom",
    clickOnEnter: true,
  },
  {
    path: "/admin/menu",
    selector: "[data-tour='nav-inquiries']",
    title: "문의 메뉴",
    body: "챗봇·홈페이지로 들어온 문의가 모이는 곳입니다.",
    placement: "right",
  },
  {
    path: "/admin/inquiries",
    title: "문의 관리",
    body: "전화번호 클릭으로 즉시 발신, 휴지통 아이콘으로 정리하세요.",
    placement: "center",
  },
];

const PAD = 8;
const CARD_W = 320;
const TIP_GAP = 12;

export function AdminTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  useEffect(() => {
    const start = () => setStep(0);
    window.addEventListener("admin-tour:start", start);
    return () => window.removeEventListener("admin-tour:start", start);
  }, []);

  useEffect(() => {
    function updateVp() {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    }
    updateVp();
    window.addEventListener("resize", updateVp);
    return () => window.removeEventListener("resize", updateVp);
  }, []);

  // 스텝 진입 시 해당 경로로 이동
  useEffect(() => {
    if (step === null) return;
    const s = STEPS[step];
    if (s.path !== pathname) router.push(s.path);
  }, [step, pathname, router]);

  // 타깃 엘리먼트 탐색 + 위치 추적
  useEffect(() => {
    if (step === null) {
      setRect(null);
      return;
    }
    const s = STEPS[step];
    if (s.path !== pathname || !s.selector) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    function findVisible(): HTMLElement | null {
      const els = document.querySelectorAll(s.selector!);
      for (const node of els) {
        if (!(node instanceof HTMLElement)) continue;
        const r = node.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return node;
      }
      return null;
    }

    function tryFind() {
      if (cancelled) return;
      const el = findVisible();
      if (el) {
        // 탭 버튼 등 — 진입 시 자동 클릭해서 패널 내용까지 함께 보이게
        if (s.clickOnEnter) {
          try {
            el.click();
          } catch {
            /* noop */
          }
        }
        const r = el.getBoundingClientRect();
        if (r.top < 80 || r.bottom > window.innerHeight - 80) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          window.setTimeout(() => {
            if (!cancelled) setRect(el.getBoundingClientRect());
          }, 400);
        } else {
          setRect(r);
        }
        return;
      }
      attempts++;
      if (attempts < 30) window.setTimeout(tryFind, 100);
      else setRect(null);
    }
    tryFind();

    function update() {
      if (cancelled) return;
      const el = findVisible();
      if (el) setRect(el.getBoundingClientRect());
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [step, pathname]);

  if (step === null) return null;

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const close = () => setStep(null);
  const goNext = () => (last ? close() : setStep(step + 1));
  const goPrev = () => {
    if (step > 0) setStep(step - 1);
  };

  // 모바일에선 left/right 가 잘림 → bottom 으로 강제
  const placement: Placement =
    vw > 0 && vw < 640 && s.placement && s.placement !== "center"
      ? "bottom"
      : (s.placement ?? "bottom");

  const cardStyle = computeCardStyle(rect, placement, vw, vh);

  return (
    <div className="fixed inset-0 z-[100]">
      {rect ? (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <mask id="admin-tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left - PAD}
                y={rect.top - PAD}
                width={rect.width + PAD * 2}
                height={rect.height + PAD * 2}
                rx={12}
                ry={12}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.72)"
            mask="url(#admin-tour-mask)"
          />
        </svg>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/70" />
      )}

      {rect && (
        <div
          className="pointer-events-none absolute rounded-xl"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow:
              "0 0 0 2px rgba(255,255,255,0.95), 0 0 28px 6px rgba(255,255,255,0.25)",
          }}
        />
      )}

      {/* 클릭 차단 레이어 — 툴팁 외 영역의 클릭을 흡수 */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        className="absolute z-10 w-[300px] max-w-[calc(100vw-32px)] rounded-xl bg-white p-4 shadow-2xl sm:w-[320px]"
        style={cardStyle}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-gray-400">
            STEP {step + 1} / {STEPS.length}
          </span>
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="투어 닫기"
          >
            <X size={14} />
          </button>
        </div>
        <h3 className="mt-2 text-base font-semibold text-gray-900">{s.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{s.body}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 0}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowLeft size={12} />
            이전
          </button>
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: i === step ? "#111827" : "#E5E7EB",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
          >
            {last ? "완료" : "다음"}
            {!last && <ArrowRight size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function computeCardStyle(
  rect: DOMRect | null,
  placement: Placement,
  vw: number,
  vh: number,
): React.CSSProperties {
  if (!rect || placement === "center" || vw === 0) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }
  const cardW = vw < 640 ? Math.min(300, vw - 32) : CARD_W;
  const cx = rect.left + rect.width / 2;
  const clampX = (x: number) =>
    Math.min(Math.max(x, 16), Math.max(16, vw - cardW - 16));

  switch (placement) {
    case "top":
      return {
        left: clampX(cx - cardW / 2),
        bottom: vh - rect.top + TIP_GAP,
      };
    case "left":
      return {
        right: vw - rect.left + TIP_GAP,
        top: Math.max(16, Math.min(rect.top, vh - 220)),
      };
    case "right":
      return {
        left: rect.right + TIP_GAP,
        top: Math.max(16, Math.min(rect.top, vh - 220)),
      };
    default:
      return {
        left: clampX(cx - cardW / 2),
        top: rect.bottom + TIP_GAP,
      };
  }
}
