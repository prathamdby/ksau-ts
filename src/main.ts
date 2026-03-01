import { registerHelpCommand } from "./cmd/help.ts";
import { registerListRemotesCommand } from "./cmd/listRemotes.ts";
import { registerQuotaCommand } from "./cmd/quota.ts";
import { registerRefreshCommand } from "./cmd/refresh.ts";
import { program } from "./cmd/root.ts";
import { registerUploadCommand } from "./cmd/upload.ts";
import { registerVersionCommand } from "./cmd/version.ts";

registerVersionCommand(program);
registerRefreshCommand(program);
registerListRemotesCommand(program);
registerQuotaCommand(program);
registerHelpCommand(program);
registerUploadCommand(program);

program.parse(process.argv);
