// @vitest-environment node
import { expect, it } from "vitest";
import { runTool } from "./process";
it("keeps timers responsive and passes shell metacharacters literally", async () => {
  let ticks = 0;
  const interval = setInterval(() => ticks++, 10);
  try {
    const value = "a b; $(throw 'bad') & \"quoted\"";
    const result = await runTool(
      process.execPath,
      ["-e", "setTimeout(()=>console.log(process.argv[1]),100)", value],
      { timeoutMs: 5000 },
    );
    expect(result.stdout.trim()).toBe(value);
    expect(ticks).toBeGreaterThan(1);
  } finally {
    clearInterval(interval);
  }
});
it("terminates a timed-out child and rejects nonzero exits", async () => {
  await expect(
    runTool(process.execPath, ["-e", "setInterval(()=>{},100)"], {
      timeoutMs: 50,
    }),
  ).rejects.toThrow("tool_timeout");
  await expect(
    runTool(process.execPath, ["-e", "process.exit(7)"], { timeoutMs: 5000 }),
  ).rejects.toThrow("tool_exit_7");
});
