/** One-off CLI OAuth landing page. State and code are verified by the pending local connector. */
export async function GET() {
  return new Response(
    "Instagram 연결을 계속하려면 브라우저 주소 전체를 실행 중인 연결 도구에 붙여넣으세요. 주소를 다른 사람에게 공유하지 마세요.",
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
