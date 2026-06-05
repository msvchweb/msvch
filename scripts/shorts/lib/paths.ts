import os from "os";
import path from "path";

/**
 * 쇼츠 파이프라인 공유 작업 디렉토리.
 * os.tmpdir() 은 OS 무관 임시 경로를 반환한다:
 *   - Windows: C:\Users\<user>\AppData\Local\Temp\shorts 류
 *   - Linux/self-hosted-bash: /tmp 하위 shorts 디렉토리 류
 * download / transcribe / edit / run / test-local 전부 이 단일 상수를 import 하여
 * 경로 불일치(특히 transcribe 청크 분할)로 인한 디버깅 난이도 높은 버그를 차단한다.
 */
export const WORK_DIR = path.join(os.tmpdir(), "shorts");
