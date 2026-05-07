/** 관리자 사이드바·하단탭·전체메뉴에서 동일 nav 항목을 식별하는 data-tour 값.
 *  AdminTour 가 selector 로 매칭하여 사이드바(데스크톱) 또는 메뉴 카드(모바일)
 *  중 보이는 쪽을 자동으로 하이라이트한다. */
export const NAV_TOUR_KEYS: Record<string, string> = {
  "/admin/notices": "nav-notices",
  "/admin/weeklies": "nav-weeklies",
  "/admin/gallery": "nav-gallery",
  "/admin/posters": "nav-posters",
  "/admin/inquiries": "nav-inquiries",
};

export function navTourKey(href: string): string | undefined {
  return NAV_TOUR_KEYS[href];
}
