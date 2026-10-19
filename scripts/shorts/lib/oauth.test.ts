// @vitest-environment node
import { expect, it } from "vitest";
import { validateOAuthCallback, parseInstagramAuthorization } from "./oauth";
it("accepts only a callback for the pending state and exact redirect", () => {
  expect(
    validateOAuthCallback(
      "http://127.0.0.1:8765/callback?code=one&state=expected",
      "http://127.0.0.1:8765/callback",
      "expected",
    ),
  ).toBe("one");
  for (const url of [
    "http://127.0.0.1:8765/callback?code=one&state=other",
    "https://attacker.example/callback?code=one&state=expected",
    "http://127.0.0.1:8765/wrong?code=one&state=expected",
    "http://127.0.0.1:8765/callback?error=access_denied&state=expected",
  ])
    expect(() =>
      validateOAuthCallback(url, "http://127.0.0.1:8765/callback", "expected"),
    ).toThrow();
});
it("uses granted scopes from the token response and rejects missing publishing permission", () => {
  const token = {
    access_token: "token",
    user_id: "17841400008460056",
    permissions: "instagram_business_basic,instagram_business_content_publish",
  };
  expect(parseInstagramAuthorization({ data: [token] })).toMatchObject({
    userId: "17841400008460056",
    scopes: ["instagram_business_basic", "instagram_business_content_publish"],
  });
  expect(
    parseInstagramAuthorization(
      '{"access_token":"token","user_id":17841400008460056,"permissions":"instagram_business_basic,instagram_business_content_publish"}',
    ).userId,
  ).toBe("17841400008460056");
  expect(() =>
    parseInstagramAuthorization({
      ...token,
      permissions: "instagram_business_basic",
    }),
  ).toThrow();
  expect(() => parseInstagramAuthorization({ data: [token, token] })).toThrow();
  expect(() =>
    parseInstagramAuthorization({ ...token, data: [token] }),
  ).toThrow();
});
