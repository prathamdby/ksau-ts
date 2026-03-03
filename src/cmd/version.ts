import { intro, log, outro } from "@clack/prompts";
import type { Command } from "commander";

declare const BUILD_VERSION: string;
declare const BUILD_COMMIT: string;
declare const BUILD_DATE: string;

function getVersion(): string {
  try {
    return BUILD_VERSION;
  } catch {
    return "1.0.0";
  }
}

function getCommit(): string {
  try {
    return BUILD_COMMIT;
  } catch {
    return "none";
  }
}

function getDate(): string {
  try {
    return BUILD_DATE;
  } catch {
    return "unknown";
  }
}

export function registerVersionCommand(program: Command): void {
  program
    .command("version")
    .description("Print the version number of ksau-ts")
    .addHelpText("after", "All software has versions. This is ksau-ts's.")
    .action(() => {
      const version = getVersion();
      const commit = getCommit();
      const date = getDate();
      intro(`ksau-ts v${version}`);
      log.info(`Commit  ${commit}`);
      log.info(`Built   ${date}`);
      outro("Done");
    });
}
