const files = Bun.embeddedFiles as unknown as Record<
  string,
  { text(): Promise<string> }
>;

export const privkey: string = await files["privkey.pem"].text();
export const passphrase: string = (
  await files["passphrase.txt"].text()
).trimEnd();
