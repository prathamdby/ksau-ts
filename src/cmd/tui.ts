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
  const units = 'KMGTPE';
  return `${result.toFixed(3)} ${units[exp]}iB`;
}

export function formatBytesSpeed(bytes: number): string {
  const unit = 1024;
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0.0 B/s';
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
  const units = 'KMGTPE';
  return `${(bytes / div).toFixed(1)} ${units[exp]}iB/s`;
}
