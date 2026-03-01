import { Command } from "commander";

export const program = new Command();

program
  .name("ksau-ts")
  .description(
    "ksau-ts is a command line tool for performing OneDrive operations\nlike uploading files and checking quota information across multiple\nOneDrive configurations.",
  )
  .option(
    "-c, --remote-config <name>",
    "Name of the remote configuration section in rclone.conf",
  );
