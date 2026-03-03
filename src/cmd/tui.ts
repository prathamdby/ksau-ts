import { homedir } from "node:os";
import pc from "picocolors";

const SPEED_WINDOW = 5;

export function formatBytesHuman(bytes: bigint): string {
  const unit = 1024n;
  if (bytes < unit) {
    return `${bytes} B`;
  }
  let div = unit;
  let exp = 0;
  for (let n = bytes / unit; n >= unit; n /= unit) {
    div *= unit;
    exp++;
  }
  const result = Number(bytes) / Number(div);
  const units = "KMGTPE";
  return `${result.toFixed(3)} ${units[exp]}iB`;
}

export function formatBytesSpeed(bytes: number): string {
  const unit = 1024;
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0.0 B/s";
  }
  if (bytes < unit) {
    return `${bytes.toFixed(1)} B/s`;
  }
  let div = unit;
  let exp = 0;
  for (let n = bytes / unit; n >= unit; n /= unit) {
    div *= unit;
    exp++;
  }
  const units = "KMGTPE";
  return `${(bytes / div).toFixed(1)} ${units[exp]}iB/s`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const remainAfterH = totalSeconds - h * 3600;
  const m = Math.floor(remainAfterH / 60);
  const s = remainAfterH - m * 60;
  if (h > 0) {
    return `${h}h${m}m${s}s`;
  }
  if (m > 0) {
    return `${m}m${s}s`;
  }
  return `${s}s`;
}

export function fmtPath(p: string): string {
  return p.replace(homedir(), "~");
}

export class SpeedTracker {
  private speedSamples: number[] = [];
  private lastCalcMs: number;
  private lastBytes: number;

  constructor() {
    this.lastCalcMs = Date.now();
    this.lastBytes = 0;
  }

  reset(): void {
    this.speedSamples = [];
    this.lastCalcMs = Date.now();
    this.lastBytes = 0;
  }

  update(bytesNow: number, timestampMs: number): number | null {
    const elapsed = (timestampMs - this.lastCalcMs) / 1000;
    if (elapsed < 1.0) {
      return null;
    }
    const chunkSize = bytesNow - this.lastBytes;
    const speed = elapsed > 0 ? chunkSize / elapsed : 0;
    this.speedSamples.push(speed);
    if (this.speedSamples.length > SPEED_WINDOW) {
      this.speedSamples.shift();
    }
    this.lastCalcMs = timestampMs;
    this.lastBytes = bytesNow;
    return (
      this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length
    );
  }
}

export const { dim, green, red, yellow, cyan, bold, gray } = pc;
