// Powershell-based window capture via Win32 API
// Finds window by PID or name, captures with PrintWindow, saves as PNG

import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

interface CaptureResult {
  image: string;
  width: number;
  height: number;
}

// Read $Target, $ProcessId, $Output from env vars (param cannot be used with -Command)
const PS_SCRIPT = `
$Target = $env:Target
$ProcessId = [int]$env:ProcessId
$Output = $env:Output

Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;

public class WinCapture {
    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, int nFlags);

    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern IntPtr GetWindow(IntPtr hWnd, int uCmd);

    [StructLayout(LayoutKind.Sequential)]
    struct RECT { public int Left, Top, Right, Bottom; }

    const int PW_RENDERFULLCONTENT = 2;
    const int GW_OWNER = 4;

    static bool IsMain(IntPtr h) {
        return IsWindowVisible(h) && GetWindow(h, GW_OWNER) == IntPtr.Zero;
    }

    public static string ByPid(int pid, string path) {
        IntPtr found = IntPtr.Zero;
        uint p = 0;
        EnumWindows((h, l) => {
            GetWindowThreadProcessId(h, out p);
            if ((int)p == pid && IsMain(h)) { found = h; return false; }
            return true;
        }, IntPtr.Zero);
        return found != IntPtr.Zero ? DoCapture(found, path) : "";
    }

    public static string ByName(string name, string path) {
        IntPtr found = IntPtr.Zero;
        uint p = 0;
        EnumWindows((h, l) => {
            GetWindowThreadProcessId(h, out p);
            var sb = new StringBuilder(512);
            GetWindowText(h, sb, 512);
            string title = sb.ToString();
            try {
                string pn = Process.GetProcessById((int)p).ProcessName;
                if (IsMain(h) && (pn.IndexOf(name, StringComparison.OrdinalIgnoreCase) >= 0 || title.IndexOf(name, StringComparison.OrdinalIgnoreCase) >= 0)) {
                    found = h; return false;
                }
            } catch {}
            return true;
        }, IntPtr.Zero);
        return found != IntPtr.Zero ? DoCapture(found, path) : "";
    }

    static string DoCapture(IntPtr h, string path) {
        RECT r;
        GetWindowRect(h, out r);
        int w = r.Right - r.Left;
        int hgt = r.Bottom - r.Top;
        if (w <= 0 || hgt <= 0) return "";
        using (var bmp = new Bitmap(w, hgt, PixelFormat.Format32bppArgb)) {
            using (var g = Graphics.FromImage(bmp)) {
                g.Clear(Color.Transparent);
                IntPtr dc = g.GetHdc();
                PrintWindow(h, dc, PW_RENDERFULLCONTENT);
                g.ReleaseHdc(dc);
            }
            bmp.Save(path, ImageFormat.Png);
        }
        return w + "," + hgt;
    }
}
'@ -ReferencedAssemblies System.Drawing,System.Runtime.InteropServices

if ($Target) {
    $dims = [WinCapture]::ByName($Target, $Output)
} elseif ($ProcessId -gt 0) {
    $dims = [WinCapture]::ByPid($ProcessId, $Output)
}
if ($dims) {
    $parts = $dims -split ','
    if ($parts.Length -eq 2) {
        $img = [System.Drawing.Image]::FromFile($Output)
        $w = $img.Width
        $h = $img.Height
        $img.Dispose()
        $result = @{image=$Output; width=$w; height=$h}
        $result | ConvertTo-Json -Compress
    }
}
`;

function runPS(target?: string, pid?: number): CaptureResult {
  const outDir = join(tmpdir(), "vision-mcp-captures");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `capture_${Date.now()}.png`);

  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", PS_SCRIPT];
  const envPS = { ...process.env, Target: target ?? "", ProcessId: String(pid ?? 0), Output: outFile };

  const stdout = execFileSync("powershell", args, {
    env: envPS,
    encoding: "utf-8",
    timeout: 30_000,
    windowsHide: true,
  });

  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("No matching window found");

  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Failed to parse capture result: ${trimmed.slice(0, 200)}`);
  }
}

export function captureTarget(target: string): CaptureResult {
  return runPS(target, undefined);
}

export function capturePid(pid: number): CaptureResult {
  return runPS(undefined, pid);
}
