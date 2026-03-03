import { cancel, intro, log, outro } from "@clack/prompts";
import type { Command } from "commander";
import { getAvailableRemotes, parseRcloneConfigData } from "../azure/config.ts";
import { getConfigData } from "./utils.ts";

export function registerListRemotesCommand(program: Command): void {
  program
    .command("list-remotes")
    .description("List available remotes from the configuration file.")
    .action(async () => {
      intro("ksau-ts list-remotes");

      let configData: Uint8Array;
      try {
        configData = await getConfigData();
      } catch (err) {
        cancel(`Failed to read config: ${(err as Error).message}`);
        process.exit(1);
      }

      let parsedConfig: Map<string, string>[];
      try {
        parsedConfig = parseRcloneConfigData(configData);
      } catch (err) {
        cancel(`Failed to parse config: ${(err as Error).message}`);
        process.exit(1);
      }

      const availableRemotes = getAvailableRemotes(parsedConfig);
      for (const remote of availableRemotes) {
        log.step(remote);
      }
      outro(`${availableRemotes.length} remotes found`);
    });
}
