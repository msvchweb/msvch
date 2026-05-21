/**
 * 갤러리 카테고리 / 하위부서 단일 출처.
 *
 * 관리자 갤러리 페이지(생성·수정 폼)와 공개 갤러리 그리드(필터)가 모두 이 모듈을 참조한다.
 * 새 카테고리나 부서를 추가할 때 여기 한 곳만 수정하면 양쪽이 동시에 갱신된다.
 */

export const GALLERY_CATEGORIES = [
  "예배",
  "교회학교",
  "교회행사",
  "봉사센터",
  "새가족",
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

/** 카테고리별 하위부서. 정의되지 않은 카테고리는 하위부서가 없다. */
export const GALLERY_SUB_CATEGORIES: Record<string, readonly string[]> = {
  교회학교: ["영유치부", "아동부", "청소년부", "청년부"],
  봉사센터: ["반찬", "이미용", "비전문화", "탁구"],
};

/**
 * 갤러리 앨범의 `tags` 배열은 [category, subCategory?] 형태로 저장한다.
 * 공개 그리드가 `tags.includes(filter)` 로 1차/2차 필터를 동시에 처리할 수 있도록 통일.
 */
export function buildTagsFromCategory(
  category: string,
  subCategory?: string | null,
): string[] {
  const tags: string[] = [category];
  if (subCategory && subCategory.length > 0) {
    tags.push(subCategory);
  }
  return tags;
}

/** 주어진 카테고리에 하위부서 옵션이 있는지 */
export function hasSubCategories(category: string): boolean {
  return Object.prototype.hasOwnProperty.call(GALLERY_SUB_CATEGORIES, category);
}

/** 주어진 카테고리의 하위부서 배열 (없으면 빈 배열) */
export function getSubCategories(category: string): readonly string[] {
  return GALLERY_SUB_CATEGORIES[category] ?? [];
}

/** tags 배열에서 카테고리 / 하위부서를 분리 — 수정 폼의 초기값 채우기용 */
export function splitTagsToCategoryAndSub(
  tags: readonly string[],
  fallbackCategory: string | null,
): { category: string; subCategory: string } {
  const category =
    tags.find((t) => (GALLERY_CATEGORIES as readonly string[]).includes(t)) ??
    fallbackCategory ??
    GALLERY_CATEGORIES[0];

  const subs = GALLERY_SUB_CATEGORIES[category] ?? [];
  const subCategory = tags.find((t) => subs.includes(t)) ?? "";

  return { category, subCategory };
}
