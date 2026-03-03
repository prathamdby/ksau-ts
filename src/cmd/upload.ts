import { statSync } from "node:fs";
import path from "node:path";
import {
  box,
  cancel,
  intro,
  isCancel,
  log,
  outro,
  progress,
  select,
  spinner,
} from "@clack/prompts";
import type { Command } from "commander";
import { AzureClient } from "../azure/client.ts";
import { KibiByte } from "../azure/constants.ts";
import type { UploadParams } from "../azure/types.ts";
import {
  formatBytesHuman,
  formatBytesSpeed,
  formatDuration,
  SpeedTracker,
} from "./tui.ts";
import {
  fetchRemoteQuotas,
  getChunkSize,
  getConfigData,
  verifyFileIntegrity,
} from "./utils.ts";

export function registerUploadCommand(program: Command): void {
  program
    .command("upload")
    .description("Upload a file to OneDrive")
    .requiredOption(
      "-f, --file <path>",
      "Path to the local file to upload (required)",
    )
    .requiredOption(
      "-r, --remote <folder>",
      "Remote folder on OneDrive to upload the file (required)",
    )
    .option(
      "-n, --remote-name <name>",
      "Optional: Remote filename (defaults to local filename)",
      "",
    )
    .option(
      "-s, --chunk-size <bytes>",
      "Chunk size for uploads in bytes (0 for automatic selection)",
      "0",
    )
    .option(
      "--retries <n>",
      "Maximum number of retries for uploading chunks",
      "3",
    )
    .option("--retry-delay <ms>", "Delay between retries in ms", "5000")
    .option("--skip-hash", "Skip QuickXorHash verification", false)
    .option(
      "--hash-retries <n>",
      "Maximum number of retries for fetching QuickXorHash",
      "5",
    )
    .option(
      "--hash-retry-delay <ms>",
      "Delay between QuickXorHash retries in ms",
      "10000",
    )
    .action(async (opts) => {
      intro("ksau-ts upload");

      const filePath: string = opts.file;
      const remoteFolder: string = opts.remote;
      const remoteFileName: string = opts.remoteName || "";
      const chunkSizeNum: number = parseInt(opts.chunkSize, 10);
      const maxRetries: number = parseInt(opts.retries, 10);
      const retryDelay: number = parseInt(opts.retryDelay, 10);
      const skipHash: boolean = opts.skipHash === true;
      const hashRetries: number = parseInt(opts.hashRetries, 10);
      const hashRetryDelay: number = parseInt(opts.hashRetryDelay, 10);

      // Resolve file size
      let fileSize: bigint;
      try {
        fileSize = BigInt(statSync(filePath).size);
      } catch (err) {
        cancel(`Failed to get file info: ${(err as Error).message}`);
        process.exit(1);
      }

      // Remote selection
      const parentOpts = program.opts();
      let remoteConfig: string = parentOpts.remoteConfig || "";

      if (!remoteConfig) {
        if (!process.stdout.isTTY) {
          // Non-interactive: auto-select remote with most free space
          try {
            const quotas = await fetchRemoteQuotas();
            if (quotas.size === 0) {
              cancel(
                "cannot automatically determine remote to be used: all remotes unavailable",
              );
              process.exit(1);
            }
            const [selected] = [...quotas.entries()].sort((a, b) =>
              b[1] > a[1] ? 1 : -1,
            );
            remoteConfig = selected[0];
            log.info(
              `Non-interactive mode — using remote with most free space: ${remoteConfig}`,
            );
          } catch (err) {
            cancel(
              `cannot automatically determine remote to be used: ${(err as Error).message}`,
            );
            process.exit(1);
          }
        } else {
          // Interactive: fetch quotas in parallel, then present select prompt
          const s = spinner();
          s.start("Checking remotes...");

          let quotas: Map<string, bigint>;
          try {
            quotas = await fetchRemoteQuotas();
          } catch (err) {
            s.stop();
            cancel(`Failed to fetch remote quotas: ${(err as Error).message}`);
            process.exit(1);
          }
          s.stop();

          if (quotas.size === 0) {
            cancel("No remotes available");
            process.exit(1);
          }

          if (quotas.size === 1) {
            const [onlyRemote] = quotas.keys();
            remoteConfig = onlyRemote;
            log.step(`Using remote: ${onlyRemote} (only available)`);
          } else {
            // Sort descending by free space (most free first)
            const sorted = [...quotas.entries()].sort((a, b) =>
              b[1] > a[1] ? 1 : -1,
            );
            const result = await select({
              message: "Select a remote",
              options: sorted.map(([name, space]) => ({
                value: name,
                label: name,
                hint: `${formatBytesHuman(space)} free`,
              })),
            });

            if (isCancel(result)) {
              cancel("Cancelled");
              process.exit(0);
            }

            remoteConfig = result as string;
          }
        }
      }

      log.step(`Remote: ${remoteConfig}`);

      // Chunk size selection
      const maxChunkSize = 160n * 320n * KibiByte;
      let chunkSizeBig: bigint;

      if (chunkSizeNum === 0) {
        chunkSizeBig = getChunkSize(fileSize);
        log.info(`Chunk size: ${formatBytesHuman(chunkSizeBig)} (auto)`);
      } else {
        chunkSizeBig = BigInt(chunkSizeNum);
        if (chunkSizeBig > maxChunkSize) {
          log.warn(
            `Reducing chunk size from ${formatBytesHuman(chunkSizeBig)} to ${formatBytesHuman(maxChunkSize)} for reliability`,
          );
          chunkSizeBig = maxChunkSize;
        } else if (chunkSizeBig % (320n * KibiByte) !== 0n) {
          log.warn(
            `Chunk size ${formatBytesHuman(chunkSizeBig)} is not a multiple of 320 KiB — upload may not be optimal`,
          );
        } else {
          log.info(
            `Chunk size: ${formatBytesHuman(chunkSizeBig)} (user-specified)`,
          );
        }
      }

      // Resolve remote file path
      const localFileName = path.basename(filePath);
      let remoteFilePath = path.posix.join(remoteFolder, localFileName);
      if (remoteFileName) {
        remoteFilePath = path.posix.join(remoteFolder, remoteFileName);
      }

      // Load config and initialise client
      let configData: Uint8Array;
      let client: AzureClient;
      try {
        configData = await getConfigData();
        client = await AzureClient.fromRcloneConfigData(
          configData,
          remoteConfig,
        );
      } catch (err) {
        cancel(`Failed to initialize client: ${(err as Error).message}`);
        process.exit(1);
      }

      const rootFolder = client.remoteRootFolder;
      const fullRemotePath = path.posix.join(rootFolder, remoteFilePath);
      log.info(`Path: ${fullRemotePath}`);

      // Progress — note: Number(totalSize) loses precision for files >2^53 bytes (~9 PB);
      // acceptable for any realistic upload size.
      const totalSize = fileSize;
      const prog = progress({ style: "heavy", max: Number(totalSize) });
      prog.start("Uploading...");

      const speedTracker = new SpeedTracker();
      let lastSpeed = 0;
      let lastUploaded = 0n;
      const uploadStartTime = Date.now();

      const progressCallback = (uploadedBytes: bigint): void => {
        const delta = uploadedBytes - lastUploaded;
        lastUploaded = uploadedBytes;

        const now = Date.now();
        const newSpeed = speedTracker.update(Number(uploadedBytes), now);
        if (newSpeed !== null) lastSpeed = newSpeed;

        const totalNum = Number(totalSize);
        const percent =
          totalNum > 0 ? (Number(uploadedBytes) * 100) / totalNum : 0;
        const elapsed = now - uploadStartTime;
        const eta =
          percent > 0 ? Math.floor(elapsed * (100 / percent) - elapsed) : 0;

        const msg = `${percent.toFixed(1)}%  ${formatBytesHuman(uploadedBytes)}/${formatBytesHuman(totalSize)} · ${formatBytesSpeed(lastSpeed)} · ~${formatDuration(eta)}`;
        prog.advance(Number(delta), msg);
      };

      const params: UploadParams = {
        filePath,
        remoteFilePath: fullRemotePath,
        chunkSize: chunkSizeBig,
        maxRetries,
        retryDelay,
        accessToken: client.accessToken,
        progressCallback,
        logger: { info: (_m) => {}, warn: (m) => log.warn(m) },
      };

      let fileID: string;
      try {
        fileID = await client.upload(params);
      } catch (err) {
        prog.stop("Upload failed");
        cancel(`Upload failed: ${(err as Error).message}`);
        process.exit(1);
      }

      if (fileID !== "") {
        prog.stop("Upload complete");

        // Construct download URL — backslashes → /, spaces → %20
        const baseURL = client.remoteBaseUrl;
        let urlPath = path.posix
          .join(remoteFolder, localFileName)
          .replace(/ /g, "%20");
        if (remoteFileName) {
          urlPath = path.posix
            .join(remoteFolder, remoteFileName)
            .replace(/ /g, "%20");
        }
        const downloadURL = `${baseURL}/${urlPath}`;
        if (baseURL) {
          box(downloadURL, "Download URL");
        } else {
          log.info(
            "File uploaded successfully. (base_url not configured — no download URL available)",
          );
        }

        if (!skipHash) {
          await verifyFileIntegrity(
            filePath,
            fileID,
            client,
            hashRetries,
            hashRetryDelay,
          );
        }

        outro("Done");
      } else {
        prog.stop("Upload failed");
        log.error("File upload failed.");
        outro("Upload failed");
      }
    });
}
