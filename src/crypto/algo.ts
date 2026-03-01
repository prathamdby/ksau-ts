import * as openpgp from "openpgp";
import { privkey, passphrase } from "./placeholder.ts";

async function getPrivateKey(): Promise<openpgp.PrivateKey> {
  let privateKey: openpgp.PrivateKey;
  try {
    privateKey = await openpgp.readPrivateKey({ armoredKey: privkey });
  } catch {
    throw new Error("Failed to create private key");
  }
  return openpgp.decryptKey({ privateKey, passphrase });
}

export async function decrypt(data: Uint8Array): Promise<Uint8Array> {
  const privateKey = await getPrivateKey();
  const message = await openpgp.readMessage({
    armoredMessage: Buffer.from(data).toString(),
  });
  const result = await openpgp.decrypt({
    message,
    decryptionKeys: privateKey,
    format: "binary",
  });
  return result.data as Uint8Array;
}

export async function encrypt(text: string): Promise<Uint8Array> {
  const privateKey = await getPrivateKey();
  const message = await openpgp.createMessage({ text });
  const encrypted = await openpgp.encrypt({
    message,
    encryptionKeys: privateKey,
  });
  return Buffer.from(encrypted as string);
}
