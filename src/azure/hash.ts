import type { AzureClient } from "./client.ts";

export async function getQuickXorHash(
  client: AzureClient,
  fileId: string,
): Promise<string> {
  await client.ensureTokenValid();

  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
  });

  if (resp.status !== 200) {
    const body = await resp.text();
    throw new Error(
      `failed to fetch file metadata, status: ${resp.status}, response: ${body}`,
    );
  }

  const metadata = JSON.parse(await resp.text()) as {
    file?: { hashes?: { quickXorHash?: string } };
  };

  const hash = metadata.file?.hashes?.quickXorHash;
  if (!hash) {
    throw new Error("quickXorHash not found in metadata");
  }

  return hash;
}
