/**
 * 포스터 마무리 합성기 — Canvas 기반.
 *
 * 책임:
 *   - 비율별 캔버스 크기 (1:1 / 9:16 / A4)
 *   - 배경(AI 이미지) cover 그리기
 *   - 한글 제목/부제목 텍스트 오버레이 (위치·크기·색·그림자)
 *   - 교회 footer 띠 (반투명 검정 + 좌:로고 + 중앙:정보 + 우:QR)
 *
 * 외부 의존: `qrcode` (이미 프로젝트 deps)
 */

import QRCode from "qrcode";
import type { PosterRatio } from "@/lib/poster-prompts";

// ─── 교회 정보 (footer 콘텐츠) ──────────────────────────────
export const CHURCH_FOOTER = {
  name: "명성비전교회",
  phone: "02-534-0691",
  address: "서울 동작구 사당로 16바길 9",
  qrUrl: "https://www.msvch.org/links",
  logoUrl: "/images/banner.avif",
} as const;

/** 비율별 최종 출력 캔버스 픽셀 크기 */
export const FINAL_DIMENSIONS: Record<PosterRatio | "16:9", { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
  a4: { w: 1240, h: 1754 }, // ≈ 150 DPI of 210 × 297 mm
  "16:9": { w: 1920, h: 1080 },
};

// ─── 텍스트 오버레이 옵션 타입 ──────────────────────────────
export type TextPosition = "top" | "middle" | "bottom";
export type TextSize = "sm" | "md" | "lg";

export interface TextSettings {
  titlePos: TextPosition;
  bodyPos: TextPosition;
  titleSize: TextSize;
  bodySize: TextSize;
  color: string;
  shadow: boolean;
}

export const DEFAULT_TEXT_SETTINGS: TextSettings = {
  titlePos: "top",
  bodyPos: "bottom",
  titleSize: "lg",
  bodySize: "md",
  color: "#ffffff",
  shadow: true,
};

const TITLE_PX_MAP: Record<TextSize, number> = { sm: 56, md: 76, lg: 100 };
const BODY_PX_MAP: Record<TextSize, number> = { sm: 28, md: 40, lg: 54 };

// ─── footer 자산 캐시 ───────────────────────────────────────
let _logoPromise: Promise<HTMLImageElement> | null = null;
let _qrPromise: Promise<HTMLImageElement> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${src}`));
    img.src = src;
  });
}

export function preloadFooterAssets(): Promise<{ logo: HTMLImageElement; qr: HTMLImageElement }> {
  if (!_logoPromise) {
    _logoPromise = loadImage(CHURCH_FOOTER.logoUrl);
  }
  if (!_qrPromise) {
    _qrPromise = QRCode.toDataURL(CHURCH_FOOTER.qrUrl, {
      width: 512,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
    }).then(loadImage);
  }
  return Promise.all([_logoPromise, _qrPromise]).then(([logo, qr]) => ({ logo, qr }));
}

// ─── 배경 cover 그리기 ──────────────────────────────────────
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cw: number,
  ch: number,
): void {
  const scale = Math.max(cw / img.width, ch / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (cw - w) / 2;
  const y = (ch - h) / 2;
  ctx.drawImage(img, x, y, w, h);
}

// ─── 텍스트 그리기 ──────────────────────────────────────────
function yPercentForPos(p: TextPosition, hasFooter: boolean, ratio?: PosterRatio | "16:9"): number {
  // 가로형(16:9)일 때는 상하 여백을 좀 더 넓게 잡아야 텍스트가 꽉 차지 않음
  const isHorizontal = ratio === "16:9";
  const bottomY = hasFooter ? (isHorizontal ? 0.72 : 0.78) : (isHorizontal ? 0.82 : 0.86);
  const topY = isHorizontal ? 0.22 : 0.16;

  switch (p) {
    case "top":
      return topY;
    case "middle":
      return 0.5;
    case "bottom":
      return bottomY;
  }
}

interface DrawBlockOpts {
  x: number;
  yPercent: number;
  fontPx: number;
  weight: string;
  color: string;
  shadow: boolean;
  canvas: HTMLCanvasElement;
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  o: DrawBlockOpts,
): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${o.weight} ${o.fontPx}px "Pretendard Variable", "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  ctx.fillStyle = o.color;
  if (o.shadow) {
    ctx.shadowColor = o.color === "#ffffff" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.45)";
    ctx.shadowBlur = Math.round(o.fontPx * 0.18);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.round(o.fontPx * 0.04);
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }

  const lineHeight = o.fontPx * 1.18;
  const totalH = lineHeight * lines.length;
  const blockTop = o.canvas.height * o.yPercent - totalH / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, o.x, blockTop + lineHeight * (i + 0.5));
  });

  // 후속 그리기에 영향 안 가게 리셋
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** 한국어/영어 혼용 줄바꿈 — 문자 단위 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontPx: number,
  weight: string,
): string[] {
  if (!text.trim()) return [];
  ctx.font = `${weight} ${fontPx}px "Pretendard Variable", "Pretendard", "Noto Sans KR", system-ui, sans-serif`;

  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    if (!paragraph.trim()) continue;
    let current = "";
    for (const ch of paragraph) {
      const trial = current + ch;
      if (ctx.measureText(trial).width <= maxWidth) {
        current = trial;
      } else {
        if (current) lines.push(current);
        current = ch;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [text];
}

// ─── 메인 렌더 함수 ─────────────────────────────────────────

export interface RenderInput {
  bg: HTMLImageElement;
  ratio: PosterRatio | "16:9";
  title: string;
  bodyText: string;
  text: TextSettings;
  showFooter: boolean;
  footerAssets?: { logo: HTMLImageElement; qr: HTMLImageElement };
}

export function renderPoster(canvas: HTMLCanvasElement, input: RenderInput): void {
  const dim = FINAL_DIMENSIONS[input.ratio];
  // 미리보기는 작은 캔버스, 다운로드는 전체 dim. 어느쪽이든 비율은 dim 기준.
  if (canvas.width === 0 || canvas.height === 0) {
    canvas.width = dim.w;
    canvas.height = dim.h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 1) 배경
  drawCover(ctx, input.bg, canvas.width, canvas.height);

  // 2) 텍스트
  const padX = canvas.width * 0.08;
  const maxTextWidth = canvas.width - padX * 2;
  const fontScale = canvas.width / 1080;
  const titlePx = Math.round(TITLE_PX_MAP[input.text.titleSize] * fontScale);
  const bodyPx = Math.round(BODY_PX_MAP[input.text.bodySize] * fontScale);

  const titleLines = wrapText(ctx, input.title, maxTextWidth, titlePx, "bold");
  const bodyLines = input.bodyText
    ? wrapText(ctx, input.bodyText, maxTextWidth, bodyPx, "normal")
    : [];

  if (titleLines.length > 0) {
    drawTextBlock(ctx, titleLines, {
      x: canvas.width / 2,
      yPercent: yPercentForPos(input.text.titlePos, input.showFooter, input.ratio),
      fontPx: titlePx,
      weight: "700",
      color: input.text.color,
      shadow: input.text.shadow,
      canvas,
    });
  }
  if (bodyLines.length > 0) {
    drawTextBlock(ctx, bodyLines, {
      x: canvas.width / 2,
      yPercent: yPercentForPos(input.text.bodyPos, input.showFooter, input.ratio),
      fontPx: bodyPx,
      weight: "400",
      color: input.text.color,
      shadow: input.text.shadow,
      canvas,
    });
  }

  // 3) footer
  if (input.showFooter && input.footerAssets) {
    drawFooter(ctx, canvas, input.footerAssets);
  }
}

// ─── 하단 footer 띠 ─────────────────────────────────────────
function drawFooter(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  assets: { logo: HTMLImageElement; qr: HTMLImageElement },
): void {
  const cw = canvas.width;
  const ch = canvas.height;
  // 띠 높이: 캔버스 높이에 비례하되, 세로가 긴 비율(9:16·A4)에서 가로 요소가 폭을 넘지 않도록 cw 기준 상한.
  const footerH = Math.round(Math.min(ch * 0.11, cw * 0.13));
  const y0 = ch - footerH;

  // 반투명 검정 띠
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, y0, cw, footerH);

  // 위쪽 1px 골드 라인 (브랜딩)
  ctx.fillStyle = "rgba(201, 168, 76, 0.65)"; // church-gold
  ctx.fillRect(0, y0, cw, Math.max(2, Math.round(footerH * 0.018)));

  const padX = Math.round(footerH * 0.55);
  const innerH = footerH * 0.65;
  const gap = Math.round(footerH * 0.75); // 로고 ↔ 텍스트 ↔ QR 사이 간격

  // 좌: 로고 (가로 비율 보존, 폭 상한 = 캔버스의 28%)
  const logoAspect = assets.logo.width / assets.logo.height;
  const maxLogoW = cw * 0.28;
  const naturalW = innerH * logoAspect;
  const logoW = Math.min(naturalW, maxLogoW);
  const logoH = logoW / logoAspect;
  const logoX = padX;
  const logoY = y0 + (footerH - logoH) / 2;
  ctx.drawImage(assets.logo, logoX, logoY, logoW, logoH);

  // 우: QR (정사각)
  const qrSide = Math.round(footerH * 0.62);
  const qrX = cw - padX - qrSide;
  const qrY = y0 + (footerH - qrSide) / 2;
  // QR 흰 배경 패딩 (어두운 띠 위에 검정 QR 만 두면 안 보임)
  const qrPad = Math.round(qrSide * 0.06);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(qrX - qrPad, qrY - qrPad, qrSide + qrPad * 2, qrSide + qrPad * 2);
  ctx.drawImage(assets.qr, qrX, qrY, qrSide, qrSide);

  // 중앙: 텍스트 (이름 / 전화 / 주소)
  const textLeft = logoX + logoW + gap;
  const textRight = qrX - qrPad - gap;
  const textCenterX = (textLeft + textRight) / 2;

  const fontScale = cw / 1080;
  const namePx = Math.round(28 * fontScale);
  const detailPx = Math.round(22 * fontScale);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";

  ctx.font = `700 ${namePx}px "Pretendard Variable", "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  ctx.fillText(CHURCH_FOOTER.name, textCenterX, y0 + footerH * 0.34);

  ctx.font = `400 ${detailPx}px "Pretendard Variable", "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.fillText(
    `${CHURCH_FOOTER.phone}  ·  ${CHURCH_FOOTER.address}`,
    textCenterX,
    y0 + footerH * 0.66,
  );
}
