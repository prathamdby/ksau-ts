export type ProgressStyle = "basic" | "blocks" | "modern" | "emoji" | "minimal";

export function validStyles(): ProgressStyle[] {
  return ["basic", "blocks", "modern", "emoji", "minimal"];
}

export function formatBytes(bytes: number): string {
  const unit = 1024;
  if (bytes < unit) {
    return `${bytes.toFixed(1)} B`;
  }
  let div = unit;
  let exp = 0;
  for (let n = bytes / unit; n >= unit; n /= unit) {
    div *= unit;
    exp++;
  }
  return `${(bytes / div).toFixed(1)} ${"KMGTPE"[exp]}iB`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const remainAfterH = totalSeconds - h * 3600;
  const m = Math.floor(remainAfterH / 60);
  const s = remainAfterH - m * 60;
  if (h > 0) {
    return `${h}h${m}m${s}s`;
  } else if (m > 0) {
    return `${m}m${s}s`;
  }
  return `${s}s`;
}

export class ProgressTracker {
  totalSize: bigint;
  uploadedSize: bigint;
  startTime: Date;
  lastUpdate: Date;
  style: ProgressStyle;
  customEmoji: string;
  width: number;
  lastChunkSize: bigint;
  lastSpeed: number;

  constructor(totalSize: bigint, style: ProgressStyle) {
    this.totalSize = totalSize;
    this.uploadedSize = 0n;
    this.startTime = new Date();
    this.lastUpdate = new Date();
    this.style = style;
    this.customEmoji = "🟦";
    this.width = 40;
    this.lastChunkSize = 0n;
    this.lastSpeed = 0;
  }

  updateProgress(uploadedSize: bigint): void {
    this.uploadedSize = uploadedSize;
    const now = new Date();
    const elapsed = (now.getTime() - this.lastUpdate.getTime()) / 1000;

    const chunkSize = uploadedSize - this.lastChunkSize;
    const speed = Number(chunkSize) / elapsed;
    if (elapsed >= 1.0) {
      this.lastSpeed = speed;
      this.lastUpdate = now;
      this.lastChunkSize = uploadedSize;
    }

    this.displayProgress();
  }

  displayProgress(): void {
    const percent = (Number(this.uploadedSize) * 100) / Number(this.totalSize);
    let progressBar: string;

    switch (this.style) {
      case "basic":
        progressBar = this.basicStyle(percent);
        break;
      case "blocks":
        progressBar = this.blockStyle(percent);
        break;
      case "modern":
        progressBar = this.modernStyle(percent);
        break;
      case "emoji":
        progressBar = this.emojiStyle(percent);
        break;
      case "minimal":
        progressBar = this.minimalStyle(percent);
        break;
      default:
        progressBar = this.basicStyle(percent);
    }

    process.stdout.write(`\r\x1b[K${progressBar}`);
  }

  private basicStyle(percent: number): string {
    const width = this.width - 2;
    const complete = Math.max(
      0,
      Math.min(width, Math.floor((percent / 100) * width)),
    );
    return `[${"=".repeat(complete)}>${" ".repeat(Math.max(0, width - complete - 1))}] ${percent.toFixed(1)}% | ${formatBytes(this.lastSpeed)}/s`;
  }

  private blockStyle(percent: number): string {
    const width = this.width;
    const complete = Math.floor((percent / 100) * width);
    return `${"█".repeat(complete)}${"░".repeat(width - complete)} ${percent.toFixed(1)}% | ${formatBytes(this.lastSpeed)}/s`;
  }

  private modernStyle(percent: number): string {
    const width = this.width;
    const complete = Math.floor((percent / 100) * width);
    return `${"●".repeat(complete)}${"○".repeat(width - complete)} ${percent.toFixed(1)}% | ${formatBytes(this.lastSpeed)}/s`;
  }

  private emojiStyle(percent: number): string {
    const width = Math.floor(this.width / 2);
    const complete = Math.floor((percent / 100) * width);
    const emoji = this.customEmoji || "🟦";
    return `${emoji.repeat(complete)}${"⬜".repeat(width - complete)} ${percent.toFixed(1)}% | ${formatBytes(this.lastSpeed)}/s`;
  }

  private minimalStyle(percent: number): string {
    const now = new Date();
    const timeElapsed = now.getTime() - this.startTime.getTime();
    let eta = 0;
    if (percent !== 0) {
      eta = Math.floor(timeElapsed * (100 / percent) - timeElapsed);
    }
    return `${percent.toFixed(1)}% | ${formatBytes(this.lastSpeed)}/s | ${formatBytes(Number(this.uploadedSize))}/${formatBytes(Number(this.totalSize))} | ETA: ${formatDuration(eta)}`;
  }

  finish(): void {
    this.updateProgress(this.totalSize);
    process.stdout.write("\n");
  }
}
