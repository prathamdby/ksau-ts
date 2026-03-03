import { cancel, intro, log, outro, spinner } from "@clack/prompts";
import type { Command } from "commander";
import { AzureClient } from "../azure/client.ts";
import { getAvailableRemotes, parseRcloneConfigData } from "../azure/config.ts";
import type { DriveQuota } from "../azure/types.ts";
import { formatBytesHuman } from "./tui.ts";
import { getConfigData } from "./utils.ts";

type QuotaResult =
  | { ok: true; remote: string; quota: DriveQuota }
  | { ok: false; remote: string; message: string };

export function registerQuotaCommand(program: Command): void {
  program
    .command("quota")
    .description("Display OneDrive quota information")
    .action(async () => {
      intro("ksau-ts quota");

      let configData: Uint8Array;
      try {
        configData = await getConfigData();
      } catch (err) {
        cancel(`Failed to read config file: ${(err as Error).message}`);
        process.exit(1);
      }

      const rcloneConfigFile = parseRcloneConfigData(configData);
      const availRemotes = getAvailableRemotes(rcloneConfigFile);

      const s = spinner();
      s.start(`Checking ${availRemotes.length} remotes...`);

      const results: QuotaResult[] = await Promise.all(
        availRemotes.map(async (remoteName): Promise<QuotaResult> => {
          let client: AzureClient;
          try {
            client = await AzureClient.fromRcloneConfigData(
              configData,
              remoteName,
            );
          } catch (e) {
            return {
              ok: false,
              remote: remoteName,
              message: (e as Error).message,
            };
          }

          try {
            const quota = await client.getDriveQuota(
              AbortSignal.timeout(10000),
            );
            return { ok: true, remote: remoteName, quota };
          } catch (e) {
            return {
              ok: false,
              remote: remoteName,
              message: (e as Error).message,
            };
          }
        }),
      );

      s.stop();

      let exitCode = 0;
      for (const result of results) {
        if (result.ok) {
          log.message(
            `${result.remote}\n` +
              `  Total:   ${formatBytesHuman(result.quota.total)}\n` +
              `  Used:    ${formatBytesHuman(result.quota.used)}\n` +
              `  Free:    ${formatBytesHuman(result.quota.remaining)}\n` +
              `  Trashed: ${formatBytesHuman(result.quota.deleted)}`,
          );
        } else {
          log.error(`Failed: ${result.remote} — ${result.message}`);
          exitCode = 1;
        }
      }

      outro(`${availRemotes.length} remotes checked`);
      if (exitCode !== 0) {
        process.exit(1);
      }
    });
}
