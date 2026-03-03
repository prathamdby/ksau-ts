import fs from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { log, spinner } from "@clack/prompts";
import { AzureClient } from "../azure/client.ts";
import { getAvailableRemotes, parseRcloneConfigData } from "../azure/config.ts";
import { KibiByte } from "../azure/constants.ts";
import { decrypt } from "../crypto/algo.ts";
import { QuickXorHash } from "../crypto/quickxorhash.ts";

const hashRetries = 5;
const hashRetryDelay = 10000;

export function getConfigPath(): string {
  const platform = process.platform;
  let configDir: string;

  if (platform === "win32") {
    configDir = path.join(process.env.APPDATA || "", "ksau", ".conf");
  } else if (
    platform === "android" ||
    platform === "linux" ||
    platform === "freebsd" ||
    platform === "openbsd" ||
    platform === "darwin"
  ) {
    configDir = path.join(os.homedir(), ".ksau", ".conf");
  } else {
    throw new Error(`unsupported OS: ${platform}`);
  }

  fs.mkdirSync(configDir, { recursive: true });
  return path.join(configDir, "rclone.conf");
}

export async function getConfigData(): Promise<Uint8Array> {
  const configPath = getConfigPath();
  const data = fs.readFileSync(configPath);
  return await decrypt(new Uint8Array(data));
}

export function getChunkSize(fileSize: bigint): bigint {
  const mb5 = 16n * 320n * KibiByte;
  const mb10 = 32n * 320n * KibiByte;
  const mb25 = 80n * 320n * KibiByte;
  const mb100 = 100n * 1024n * 1024n;
  const gb1 = 1024n * 1024n * 1024n;

  if (fileSize < mb100) {
    return mb5;
  } else if (fileSize < gb1) {
    return mb10;
  } else {
    return mb25;
  }
}

export async function fetchRemoteQuotas(): Promise<Map<string, bigint>> {
  const rcloneConfigData = await getConfigData();
  const parsedRcloneConfigData = parseRcloneConfigData(rcloneConfigData);
  const availRemotes = getAvailableRemotes(parsedRcloneConfigData);

  const remoteAndSpace = new Map<string, bigint>();

  await Promise.all(
    availRemotes.map(async (remote) => {
      try {
        const client = await AzureClient.fromRcloneConfigData(
          rcloneConfigData,
          remote,
        );
        const quota = await client.getDriveQuota(AbortSignal.timeout(10000));
        remoteAndSpace.set(remote, quota.remaining);
      } catch {
        // silently skip unavailable remotes
      }
    }),
  );

  return remoteAndSpace;
}

export async function selectRemoteAutomatically(
  _fileSize: bigint,
): Promise<string> {
  const quotas = await fetchRemoteQuotas();

  if (quotas.size === 0) {
    throw new Error(
      "cannot get remote with the most free space: all remote were not available",
    );
  }

  let selectedRemote = "";
  let maxSpace = -1n;
  for (const [remote, space] of quotas) {
    if (space > maxSpace) {
      maxSpace = space;
      selectedRemote = remote;
    }
  }

  return selectedRemote;
}

export async function verifyFileIntegrity(
  filePath: string,
  fileId: string,
  client: AzureClient,
  retries = hashRetries,
  retryDelay = hashRetryDelay,
): Promise<void> {
  const s = spinner();
  s.start("Verifying integrity...");

  let fileHash = "";
  let lastErr: unknown;

  for (let i = 0; i < retries; i++) {
    if (i > 0) {
      s.message(`Verifying integrity... (attempt ${i + 1}/${retries})`);
    }
    try {
      fileHash = await client.getQuickXorHash(fileId);
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  if (lastErr !== undefined) {
    s.stop();
    log.warn(`Could not verify integrity: ${(lastErr as Error).message}`);
    return;
  }

  let data: Uint8Array;
  try {
    const buf = await readFile(filePath);
    data = new Uint8Array(buf);
  } catch (err) {
    s.stop();
    log.warn(
      `Could not read local file for verification: ${(err as Error).message}`,
    );
    return;
  }

  let localHash: string;
  try {
    const hashBytes = QuickXorHash.sum(data);
    localHash = Buffer.from(hashBytes).toString("base64");
  } catch (err) {
    s.stop();
    log.warn(`Could not calculate file hash: ${(err as Error).message}`);
    return;
  }

  if (localHash === fileHash) {
    s.stop("Integrity verified — hashes match");
  } else {
    s.stop();
    log.warn("Integrity check failed — hashes do not match");
  }
}
