import type { AzureClient } from "./client.ts";
import type { DriveQuota } from "./types.ts";

export async function getDriveQuota(
  client: AzureClient,
  signal?: AbortSignal,
): Promise<DriveQuota> {
  await client.ensureTokenValid();

  const url = "https://graph.microsoft.com/v1.0/me/drive/quota";

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
    signal,
  });

  if (resp.status !== 200) {
    const body = await resp.text();
    throw new Error(
      `failed to fetch quota information, status: ${resp.status}, response: ${body}`,
    );
  }

  const data = JSON.parse(await resp.text()) as {
    total: number;
    used: number;
    remaining: number;
    deleted: number;
  };

  return {
    total: BigInt(data.total),
    used: BigInt(data.used),
    remaining: BigInt(data.remaining),
    deleted: BigInt(data.deleted),
  };
}

export function formatBytes(bytes: bigint): string {
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

export function displayQuotaInfo(remote: string, quota: DriveQuota): void {
  console.log(`Remote: ${remote}`);
  console.log(`Total:   ${formatBytes(quota.total)}`);
  console.log(`Used:    ${formatBytes(quota.used)}`);
  console.log(`Free:    ${formatBytes(quota.remaining)}`);
  console.log(`Trashed: ${formatBytes(quota.deleted)}`);
  console.log();
}
