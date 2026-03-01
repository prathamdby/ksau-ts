import { Command } from "commander";

const program = new Command();

program
  .name("ksau-ts")
  .description("TypeScript + Bun rewrite of ksau-go")
  .version("1.0.0");

program.parse(process.argv);
