import { spawn } from "node:child_process";
export interface ToolResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
export interface ToolOptions {
  timeoutMs: number;
  signal?: AbortSignal;
  cwd?: string;
}
export function runTool(
  executable: string,
  args: string[],
  options: ToolOptions,
): Promise<ToolResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new Error("tool_aborted"));
      return;
    }
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "",
      stopped: string | undefined;
    const cap = 1024 * 1024;
    child.stdout.on("data", (b) => {
      stdout = (stdout + b.toString()).slice(-cap);
    });
    child.stderr.on("data", (b) => {
      stderr = (stderr + b.toString()).slice(-cap);
    });
    function stop(reason: string) {
      stopped = reason;
      if (process.platform === "win32" && child.pid) {
        const killer = spawn(
          "taskkill",
          ["/pid", String(child.pid), "/T", "/F"],
          { windowsHide: true, stdio: "ignore" },
        );
        killer.on("error", () => child.kill("SIGKILL"));
      } else child.kill("SIGKILL");
    }
    const timer = setTimeout(() => stop("tool_timeout"), options.timeoutMs);
    const abort = () => stop("tool_aborted");
    options.signal?.addEventListener("abort", abort, { once: true });
    function cleanup() {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
    child.on("error", () => {
      cleanup();
      reject(new Error(`tool_start_failed:${executable}`));
    });
    child.on("close", (code) => {
      cleanup();
      if (stopped || code !== 0)
        reject(new Error(stopped ?? `tool_exit_${code}:${executable}`));
      else resolve({ exitCode: code, stdout, stderr });
    });
  });
}
