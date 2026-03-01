import { type Command } from "commander";

export function registerHelpCommand(program: Command): void {
  program
    .command("help [command]")
    .description("Get detailed help about commands")
    .action((cmd?: string) => {
      if (!cmd) {
        console.log("ksau-ts - OneDrive Upload Utility");
        console.log("\nAvailable Commands:");
        console.log("\nupload - Upload files to OneDrive");
        console.log("  Examples:");
        console.log("    # Upload a file to the root folder");
        console.log("    ksau-ts upload -f myfile.txt -r /");
        console.log("    # Upload with custom remote name");
        console.log("    ksau-ts upload -f local.txt -r /docs -n remote.txt");
        console.log("    # Upload with specific chunk size (in bytes)");
        console.log("    ksau-ts upload -f large.zip -r /backup -s 8388608");
        console.log("    # Upload using different remote config");
        console.log(
          "    ksau-ts upload -f file.pdf -r /shared --remote-config saurajcf",
        );
        console.log("\nquota - Display OneDrive quota information");
        console.log("  Examples:");
        console.log("    # Show quota for all remotes");
        console.log("    ksau-ts quota");
        console.log("    # Show quota for specific remote");
        console.log("    ksau-ts quota --remote-config oned");
        console.log("\nversion - Show version information");
        console.log("  Example:");
        console.log("    ksau-ts version");
        console.log("\nGlobal Flags:");
        console.log(
          "  --remote-config  Name of the remote configuration (default: oned)",
        );
      } else {
        console.log("Help for '" + cmd + "' command:");
        switch (cmd) {
          case "upload":
            printUploadHelp();
            break;
          case "quota":
            printQuotaHelp();
            break;
          case "version":
            printVersionHelp();
            break;
          case "refresh":
            printRefreshHelp();
            break;
          case "list-remote":
            printListRemoteHelp();
            break;
          default:
            console.log("Unknown command: " + cmd);
        }
      }
    });
}

function printUploadHelp(): void {
  console.log(`
Upload Command
-------------
Upload files to OneDrive with support for chunked uploads and integrity verification.

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
  # Basic file upload
  ksau-ts upload -f document.pdf -r /Documents

  # Upload with different name
  ksau-ts upload -f local.txt -r /Backup -n remote.txt

  # Upload large file with custom chunk size
  ksau-ts upload -f large.iso -r /ISOs -s 16777216 -p 4`);
}

function printQuotaHelp(): void {
  console.log(`
Quota Command
------------
Display storage quota information for OneDrive remotes.

Usage:
  ksau-ts quota [flags]

The quota command will display:
- Total space
- Used space
- Available space
- Usage percentage

For each configured remote (oned, saurajcf, etc.)

Example:
  ksau-ts quota`);
}

function printVersionHelp(): void {
  console.log(`
Version Command
--------------
Display version information for ksau-ts.

Usage:
  ksau-ts version

Shows:
- Version number
- Commit hash
- Build date

Example:
  ksau-ts version`);
}

function printRefreshHelp(): void {
  console.log(`
Refresh Command
---------------
Refresh the configuration file and cache.

Usage:
  ksau-ts refresh [flags]
  
Optional Flags:
  -u, --url     Custom URL to fetch the configuration file (must be direct).

Note:
  The configuration file is encrypted and stored in common config path for your OS.
  It is decrypted in memory, so there is no point trying to read it yourself.`);
}

function printListRemoteHelp(): void {
  console.log(`
List Remote Command
-------------------
List available remotes from the configuration file.

Usage:
  ksau-ts list-remote

Note:
  This command will list all available remotes from the configuration file.
  If the command fails, run refresh.`);
}
