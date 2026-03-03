import fs from "node:fs";
import { cancel, intro, log, outro, spinner } from "@clack/prompts";
import type { Command } from "commander";
import { fmtPath } from "./tui.ts";
import { getConfigPath } from "./utils.ts";

const DEFAULT_URL =
  "https://raw.githubusercontent.com/global-index-source/creds/main/rclone.conf.asc";

export function registerRefreshCommand(program: Command): void {
  program
    .command("refresh")
    .description("Refresh rclone config file")
    .option("-u, --url <url>", "Sets a custom url (must be direct.)")
    .action(async (opts) => {
      intro("ksau-ts refresh");
      const targetUrl: string = opts.url || DEFAULT_URL;
      const s = spinner();
      s.start(
        opts.url
          ? `Fetching config from ${targetUrl}...`
          : "Fetching config...",
      );

      let resp: Response;
      try {
        resp = await fetch(targetUrl);
      } catch (err) {
        s.stop();
        cancel(`Failed to fetch config: ${(err as Error).message}`);
        process.exit(1);
      }

      let body: Uint8Array;
      try {
        body = new Uint8Array(await resp.arrayBuffer());
      } catch (err) {
        s.stop();
        cancel(`Bad response: ${(err as Error).message}`);
        process.exit(1);
      }

      s.stop("Config fetched");
      const configPath = getConfigPath();
      fs.writeFileSync(configPath, body);
      log.info(`Saved to ${fmtPath(configPath)}`);
      outro("Done");
    });
}
