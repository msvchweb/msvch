/**
 * 브라우저 Canvas 기반 이미지 압축.
 * 외부 라이브러리 없이 동작.
 *
 * 알고리즘: maxBytes 이하로 떨어질 때까지
 *   ① 품질을 단계적으로 낮추고
 *   ② 그래도 안 되면 longest edge를 단계적으로 줄임
 * JPEG로 출력 (PNG의 알파 채널은 흰 배경으로 대체).
 */

const QUALITY_STEPS = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4] as const;
const EDGE_STEPS = [2400, 2000, 1600, 1200, 900] as const;

export interface CompressResult {
  file: File;
  /** 원본 대비 줄어든 비율 (0~1) */
  ratio: number;
}

/**
 * 저장용 webp 변환.
 *
 * Vercel 이미지 최적화를 끈 뒤로는 브라우저가 저장된 파일을 그대로 받는다.
 * 그래서 **업로드 시점에 적정 크기로 만들어 두는 것**이 유일한 최적화 지점이다.
 * (실측: 3.1MB JPEG → 2400px webp 381KB, 1.8MB PNG → webp 154KB)
 *
 * 실패하면 null — 호출부는 원본으로 폴백한다. 변환은 있으면 좋은 것이지,
 * 업로드 자체를 막아서는 안 된다.
 */
export async function toWebImage(
  source: Blob,
  options: { maxEdge: number; quality: number },
): Promise<Blob | null> {
  try {
    const img = await loadImage(source);
    const scale = Math.min(1, options.maxEdge / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/webp", options.quality);
    });
    // 변환 결과가 원본보다 크면(이미 잘 압축된 소형 이미지) 원본을 쓰는 게 낫다.
    return blob && blob.size < source.size ? blob : null;
  } catch {
    return null;
  }
}

/**
 * 주보 사진 — 글자가 있는 문서라 확대 판독이 가능해야 한다.
 * 2400px 는 원본(3500px 급) 대비 88% 줄이면서 잔글씨가 읽히는 선.
 */
export const WEEKLY_PHOTO_PRESET = { maxEdge: 2400, quality: 0.85 } as const;

/** 공지 히어로·본문 이미지 — 화면 표시용이라 1600px 로 충분. */
export const CONTENT_IMAGE_PRESET = { maxEdge: 1600, quality: 0.82 } as const;

/** 목록용 썸네일. */
export async function createThumbnail(
  source: Blob,
  maxEdge = 480,
): Promise<Blob | null> {
  return toWebImage(source, { maxEdge, quality: 0.78 });
}

export async function compressImage(
  file: File,
  maxBytes: number,
): Promise<CompressResult> {
  const img = await loadImage(file);

  for (const maxEdge of EDGE_STEPS) {
    for (const quality of QUALITY_STEPS) {
      const blob = await drawAndExport(img, maxEdge, quality);
      if (!blob) continue;
      if (blob.size <= maxBytes) {
        const baseName = file.name.replace(/\.[^.]+$/, "");
        const compressed = new File([blob], `${baseName}.jpg`, {
          type: "image/jpeg",
        });
        return { file: compressed, ratio: blob.size / file.size };
      }
    }
  }

  throw new Error(
    "이미지를 5MB 이하로 압축할 수 없습니다. 더 작은 사진을 사용해주세요.",
  );
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };
    img.src = url;
  });
}

async function drawAndExport(
  img: HTMLImageElement,
  maxEdge: number,
  quality: number,
): Promise<Blob | null> {
  const { width, height } = scaleToMax(img.width, img.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
  });
}

function scaleToMax(
  w: number,
  h: number,
  maxEdge: number,
): { width: number; height: number } {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h };
  const ratio = w > h ? maxEdge / w : maxEdge / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}
