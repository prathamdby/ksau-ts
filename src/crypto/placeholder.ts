import { readFileSync } from "node:fs";

import privkeyPath from "./privkey.pem" with { type: "file" };
import passphrasePath from "./passphrase.txt" with { type: "file" };

export const privkey: string = readFileSync(privkeyPath, "utf8");

export const passphrase: string = readFileSync(passphrasePath, "utf8").trimEnd();
