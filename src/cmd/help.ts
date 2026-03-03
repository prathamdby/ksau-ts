import { intro, log, note, outro } from "@clack/prompts";
import type { Command } from "commander";

export function registerHelpCommand(program: Command): void {
  program
    .command("help [command]")
    .description("Get detailed help about commands")
    .action((cmd?: string) => {
      intro("ksau-ts help");

      if (!cmd) {
        note(
          [
            "upload        Upload files to OneDrive",
            "quota         Display OneDrive quota information",
            "refresh       Refresh rclone config file",
            "list-remotes  List available remotes",
            "version       Show version information",
            "",
            "Global Flags:",
            "  --remote-config  Name of the remote configuration (default: oned)",
          ].join("\n"),
          "Available Commands",
        );
      } else {
        switch (cmd) {
          case "upload":
            note(uploadHelp, "upload");
            break;
          case "quota":
            note(quotaHelp, "quota");
            break;
          case "version":
            note(versionHelp, "version");
            break;
          case "refresh":
            note(refreshHelp, "refresh");
            break;
          case "list-remotes":
            note(listRemoteHelp, "list-remotes");
            break;
          default:
            log.error(`Unknown command: ${cmd}`);
            process.exit(1);
        }
      }

      outro("Done");
    });
}

const uploadHelp = `Upload files to OneDrive with support for chunked uploads and integrity verification.

Usage:
  ksau-ts upload -f <file> -r <remote-path> [flags]

Required Flags:
  -f, --file          Path to the local file to upload
  -r, --remote        Remote folder path on OneDrive

Optional Flags:
  -n, --remote-name     Custom name for the uploaded file
  -s, --chunk-size      Size of upload chunks in bytes (default: automatic)
  -p, --parallel        Number of parallel upload chunks (default: 1)
      --retries         Maximum upload retry attempts (default: 3)
      --retry-delay     Delay between retries (default: 5s)
      --skip-hash       Skip file integrity verification
      --hash-retries    Maximum hash verification retries (default: 5)

Examples:
  ksau-ts upload -f document.pdf -r /Documents
  ksau-ts upload -f local.txt -r /Backup -n remote.txt
  ksau-ts upload -f large.iso -r /ISOs -s 16777216 -p 4`;

const quotaHelp = `Display storage quota information for OneDrive remotes.

Usage:
  ksau-ts quota [flags]

Shows Total, Used, Available, and Trashed space for each configured remote.

Example:
  ksau-ts quota`;

const versionHelp = `Display version information for ksau-ts.

Usage:
  ksau-ts version

Shows version number, commit hash, and build date.

Example:
  ksau-ts version`;

const refreshHelp = `Refresh the configuration file and cache.

Usage:
  ksau-ts refresh [flags]

Optional Flags:
  -u, --url     Custom URL to fetch the configuration file (must be direct).

Note:
  The configuration file is encrypted and stored in common config path for your OS.
  It is decrypted in memory, so there is no point trying to read it yourself.`;

const listRemoteHelp = `List available remotes from the configuration file.

Usage:
  ksau-ts list-remote

Note:
  This command will list all available remotes from the configuration file.
  If the command fails, run refresh.`;
