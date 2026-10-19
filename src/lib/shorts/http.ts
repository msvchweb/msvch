import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/admin-auth";
import { ShortsError } from "./generation";
export function shortsHttpError(error: unknown) {
  if (error instanceof AuthError || error instanceof ShortsError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError || error instanceof SyntaxError)
    return NextResponse.json(
      { error: "입력 형식을 확인하세요." },
      { status: 400 },
    );
  return NextResponse.json(
    { error: "쇼츠 작업을 처리하지 못했습니다. 다시 확인해 주세요." },
    { status: 503 },
  );
}
