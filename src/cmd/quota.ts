import { type Command } from "commander";
import { AzureClient } from "../azure/client.ts";
import { parseRcloneConfigData, getAvailableRemotes } from "../azure/config.ts";
import { displayQuotaInfo } from "../azure/quota.ts";
import { getConfigData } from "./utils.ts";

export function registerQuotaCommand(program: Command): void {
  program
    .command("quota")
    .description("Display OneDrive quota information")
    .action(async () => {
      const configData = await getConfigData();
      const rcloneConfigFile = parseRcloneConfigData(configData);
      const availRemotes = getAvailableRemotes(rcloneConfigFile);
      let exitCode = 0;

      await Promise.all(
        availRemotes.map(async (remoteName) => {
          let client: AzureClient;
          try {
            client = await AzureClient.fromRcloneConfigData(
              configData,
              remoteName,
            );
          } catch (e) {
            console.log(
              "Failed to initialize client for remote '" + remoteName + "': ",
              e,
            );
            exitCode = 1;
            return;
          }

          let quota;
          try {
            quota = await client.getDriveQuota();
          } catch (e) {
            console.log(
              "Failed to fetch quota information for remote '" +
                remoteName +
                "': ",
              e,
            );
            exitCode = 1;
            return;
          }

          displayQuotaInfo(remoteName, quota);
        }),
      );

      if (exitCode !== 0) {
        process.exit(1);
      }
    });
}
