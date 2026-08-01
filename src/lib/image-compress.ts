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
 * 목록용 썸네일 생성 (webp).
 *
 * Vercel 이미지 최적화를 끈 뒤로는 브라우저가 원본을 그대로 받는다.
 * 앨범 목록이 평균 730KB 짜리 원본을 그대로 로드하지 않도록,
 * 업로드 시점에 작은 썸네일을 따로 만들어 둔다.
 *
 * 실패하면 null — 호출부는 원본 URL 로 폴백한다 (썸네일은 있으면 좋은 것).
 */
export async function createThumbnail(
  source: Blob,
  maxEdge = 480,
): Promise<Blob | null> {
  try {
    const img = await loadImage(source);
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/webp", 0.78);
    });
  } catch {
    return null;
  }
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
