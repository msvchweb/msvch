import { NextResponse } from "next/server";

/**
 * 표준 API 응답 shape.
 *
 * 이후 RN 모바일 앱이 동일 엔드포인트를 호출할 때 분기 없이 항상
 * `{ ok, data?, error? }` 로 파싱할 수 있도록 새 라우트는 이 헬퍼를 사용한다.
 *
 * 기존 라우트는 점진적으로 마이그레이션 (이번 라운드에서는 강제 교체하지 않음).
 */
export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiFail {
  ok: false;
  error: string;
}

export type ApiResult<T> = ApiOk<T> | ApiFail;

/** 200 (또는 init.status) 성공 응답. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiOk<T>> {
  return NextResponse.json<ApiOk<T>>({ ok: true, data }, init);
}

/** 에러 응답. status 기본 500. */
export function fail(
  message: string,
  status = 500,
  init?: Omit<ResponseInit, "status">,
): NextResponse<ApiFail> {
  return NextResponse.json<ApiFail>(
    { ok: false, error: message },
    { ...init, status },
  );
}
