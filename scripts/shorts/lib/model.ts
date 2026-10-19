import { z } from "zod";
const ResponseSchema = z.object({
  candidates: z.array(
    z.object({
      content: z.object({ parts: z.array(z.object({ text: z.string() })) }),
    }),
  ),
});
export async function modelJson(
  prompt: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("gemini_key_missing");
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(120000)])
        : AbortSignal.timeout(120000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) throw new Error(`gemini_http_${response.status}`);
  const data = ResponseSchema.parse(await response.json());
  return JSON.parse(
    data.candidates[0].content.parts.map((p) => p.text).join(""),
  );
}
