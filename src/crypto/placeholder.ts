import { readFileSync } from "node:fs";
import { join } from "node:path";

const embedded = Bun.embeddedFiles as unknown as Record<
  string,
  { text(): Promise<string> } | undefined
>;

// In compiled binaries without --asset, fall back to cwd since import.meta.dir is //root
const baseDir = embedded["privkey.pem"] ? import.meta.dir : process.cwd();

export const privkey: string = embedded["privkey.pem"]
  ? await embedded["privkey.pem"].text()
  : readFileSync(join(baseDir, "src/crypto/privkey.pem"), "utf8");

export const passphrase: string = (
  embedded["passphrase.txt"]
    ? await embedded["passphrase.txt"].text()
    : readFileSync(join(baseDir, "src/crypto/passphrase.txt"), "utf8")
).trimEnd();
