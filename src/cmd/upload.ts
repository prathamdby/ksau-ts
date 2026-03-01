import { statSync } from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import { AzureClient } from "../azure/client.ts";
import { KibiByte } from "../azure/constants.ts";
import type { UploadParams } from "../azure/types.ts";
import {
  type ProgressStyle,
  ProgressTracker,
  validStyles,
} from "./progress/progress.ts";
import {
  ColorGreen,
  ColorReset,
  getChunkSize,
  getConfigData,
  selectRemoteAutomatically,
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
    .option(
      "--progress <style>",
      `Progress bar style for upload visualization:
\tbasic:   [=====>     ] 45% | 5.2MB/s
\tblocks:  █████░░░░░ 45% | 5.2MB/s
\tmodern:  ○○●●●○○○ 45% | 5.2MB/s
\temoji:   🟦🟦🟦⬜⬜ 45% | 5.2MB/s
\tminimal: 45% | 5.2MB/s | 42MB/100MB | ETA: 2m30s`,
      "modern",
    )
    .option(
      "--emoji <emoji>",
      `Custom emoji for emoji progress style. Examples:
\t🟦 (blue square), 🟩 (green square), 🌟 (star),
\t⭐ (yellow star), 🚀 (rocket), 📦 (package)`,
      "🟦",
    )
    .action(async (opts) => {
      const filePath: string = opts.file;
      const remoteFolder: string = opts.remote;
      const remoteFileName: string = opts.remoteName || "";
      const chunkSizeNum: number = parseInt(opts.chunkSize, 10);
      const maxRetries: number = parseInt(opts.retries, 10);
      const retryDelay: number = parseInt(opts.retryDelay, 10);
      const skipHash: boolean = opts.skipHash === true;
      const hashRetries: number = parseInt(opts.hashRetries, 10);
      const hashRetryDelay: number = parseInt(opts.hashRetryDelay, 10);
      const progressStyle: string = opts.progress;
      const customEmoji: string = opts.emoji;

      if (!validStyles().includes(progressStyle as ProgressStyle)) {
        console.log(
          "Invalid progress style: " +
            progressStyle +
            "\nValid styles are: basic, blocks, modern, emoji, minimal",
        );
        return;
      }

      let fileSize: bigint;
      try {
        fileSize = BigInt(statSync(filePath).size);
      } catch (err) {
        console.log("Failed to get file info:", (err as Error).message);
        return;
      }

      const parentOpts = program.opts();
      let remoteConfig: string = parentOpts.remoteConfig || "";

      if (!remoteConfig) {
        try {
          remoteConfig = await selectRemoteAutomatically(
            fileSize,
            progressStyle as ProgressStyle,
          );
        } catch (err) {
          console.log(
            "cannot automatically determine remote to be used:",
            (err as Error).message,
          );
          process.exit(1);
        }
      }

      const maxChunkSize = 160n * 320n * KibiByte;
      let chunkSizeBig: bigint;

      if (chunkSizeNum === 0) {
        chunkSizeBig = getChunkSize(fileSize);
        console.log(
          "Selected chunk size: " +
            chunkSizeBig +
            " bytes (based on file size: " +
            fileSize +
            " bytes)",
        );
      } else {
        chunkSizeBig = BigInt(chunkSizeNum);
        if (chunkSizeBig > maxChunkSize) {
          console.log(
            "Warning: Reducing chunk size from " +
              chunkSizeBig +
              " to " +
              maxChunkSize +
              " bytes for reliability",
          );
          chunkSizeBig = maxChunkSize;
        } else if (chunkSizeBig % (320n * KibiByte) !== 0n) {
          console.log(
            "Warning: Chunk size " +
              chunkSizeBig +
              " is not multiple of 320KiB, upload may not be optimal",
          );
        } else {
          console.log(`Using user-specified chunk size: ${chunkSizeBig} bytes`);
        }
      }

      const localFileName = path.basename(filePath);
      let remoteFilePath = path.posix.join(remoteFolder, localFileName);
      if (remoteFileName) {
        remoteFilePath = path.posix.join(remoteFolder, remoteFileName);
      }

      let configData: Uint8Array;
      try {
        configData = await getConfigData();
      } catch (err) {
        console.log("Failed to read config file:", (err as Error).message);
        return;
      }

      let client: AzureClient;
      try {
        client = await AzureClient.fromRcloneConfigData(
          configData,
          remoteConfig,
        );
      } catch (err) {
        console.log("Failed to initialize client:", (err as Error).message);
        return;
      }

      const rootFolder = client.remoteRootFolder;
      const fullRemotePath = path.posix.join(rootFolder, remoteFilePath);
      console.log(`Full remote path: ${fullRemotePath}`);

      let tracker: ProgressTracker | null = new ProgressTracker(
        fileSize,
        progressStyle as ProgressStyle,
      );
      tracker.customEmoji = customEmoji;

      let progressCallback: ((uploadedBytes: bigint) => void) | null = null;
      if (tracker !== null) {
        progressCallback = (uploadedBytes: bigint) => {
          if (tracker === null) return;
          try {
            tracker.updateProgress(uploadedBytes);
          } catch (r) {
            console.log(`\nWarning: Progress update failed: ${r}`);
            tracker = null;
          }
        };
      }

      const params: UploadParams = {
        filePath,
        remoteFilePath: fullRemotePath,
        chunkSize: chunkSizeBig,
        maxRetries,
        retryDelay,
        accessToken: client.accessToken,
        progressCallback,
      };

      let fileID: string;
      try {
        fileID = await client.upload(params);
      } catch (err) {
        if (tracker !== null) {
          tracker.finish();
        }
        console.log("\nFailed to upload file:", (err as Error).message);
        return;
      }

      if (fileID !== "") {
        if (tracker !== null) {
          tracker.updateProgress(fileSize);
          tracker.finish();
        }
        console.log("\nFile uploaded successfully.");

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
        console.log(
          ColorGreen +
            "Download URL:" +
            ColorReset +
            " " +
            ColorGreen +
            downloadURL +
            ColorReset,
        );

        if (!skipHash) {
          await verifyFileIntegrity(
            filePath,
            fileID,
            client,
            hashRetries,
            hashRetryDelay,
          );
        }
      } else {
        if (tracker !== null) {
          tracker.finish();
        }
        console.log("\nFile upload failed.");
      }
    });
}
