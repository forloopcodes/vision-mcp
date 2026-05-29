// Platform abstraction for screen capture
// Currently Windows-only with PowerShell+Win32. Extensible for macOS/Linux.

import { captureTarget, capturePid } from "./windows.js";

export interface CaptureResult {
  image: string;
  width: number;
  height: number;
}

export function capture(pid?: number, target?: string): CaptureResult {
  if (pid !== undefined) return capturePid(pid);
  if (target) return captureTarget(target);
  throw new Error("Provide either pid or target");
}
