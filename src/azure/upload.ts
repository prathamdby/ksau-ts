import type { AzureClient } from "./client.ts";
import type { UploadParams } from "./types.ts";

export async function upload(
  client: AzureClient,
  params: UploadParams,
): Promise<string> {
  console.log("Starting file upload with upload session...");

  await client.ensureTokenValid();

  let uploadURL = await createUploadSession(client, params.remoteFilePath);
  console.log("Upload session created successfully.");

  const file = Bun.file(params.filePath);
  const fileSize = BigInt(file.size);
  console.log(`File size: ${fileSize} bytes`);

  const chunkSize = params.chunkSize;
  let totalUploaded = 0n;

  for (let start = 0n; start < fileSize; start += chunkSize) {
    let end = start + chunkSize - 1n;
    if (end >= fileSize) {
      end = fileSize - 1n;
    }

    const chunk = file.slice(Number(start), Number(end) + 1);

    let uploaded = false;
    for (let retry = 0; retry < params.maxRetries; retry++) {
      await client.ensureTokenValid();
      try {
        const success = await uploadChunk(
          client,
          uploadURL,
          chunk,
          start,
          end,
          fileSize,
        );
        if (success) {
          totalUploaded += end - start + 1n;
          if (params.progressCallback !== null) {
            params.progressCallback(totalUploaded);
          }
          uploaded = true;
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (retry < params.maxRetries - 1) {
          if (
            msg.includes("resourceModified") ||
            msg.includes("invalidRange")
          ) {
            try {
              const newURL = await createUploadSession(
                client,
                params.remoteFilePath,
              );
              uploadURL = newURL;
              console.log("Created new upload session after error");
            } catch (sessionErr) {
              console.log(
                `Failed to create new upload session: ${sessionErr instanceof Error ? sessionErr.message : String(sessionErr)}`,
              );
            }
          }

          console.log(`Error uploading chunk ${start}-${end}: ${msg}`);
          console.log(
            `Retrying chunk upload (attempt ${retry + 1}/${params.maxRetries})...`,
          );
          await sleep(params.retryDelay);
        } else {
          throw new Error(
            `failed to upload chunk after ${params.maxRetries} retries: ${msg}`,
          );
        }
      }
    }

    if (!uploaded) {
      throw new Error(
        `failed to upload chunk after ${params.maxRetries} retries: unknown error`,
      );
    }
  }

  return getFileID(client, params.remoteFilePath);
}

export async function createUploadSession(
  client: AzureClient,
  remoteFilePath: string,
): Promise<string> {
  await client.ensureTokenValid();

  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${remoteFilePath}:/createUploadSession`;
  const body = JSON.stringify({
    item: { "@microsoft.graph.conflictBehavior": "replace" },
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.accessToken}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (resp.status !== 200) {
    const respBody = await resp.text();
    throw new Error(
      `failed to create upload session, status: ${resp.status}, response: ${respBody}`,
    );
  }

  const data = JSON.parse(await resp.text()) as { uploadUrl: string };
  return data.uploadUrl;
}

export async function uploadChunk(
  _client: AzureClient,
  uploadUrl: string,
  chunk: Uint8Array | Blob,
  start: bigint,
  end: bigint,
  totalSize: bigint,
): Promise<boolean> {
  if (start < 0n) {
    throw new Error(
      `invalid chunk range: start=${start}, end=${end}, total=${totalSize}`,
    );
  }
  if (end < start) {
    throw new Error(
      `invalid chunk range: start=${start}, end=${end}, total=${totalSize}`,
    );
  }
  const expectedSize = end - start + 1n;
  const chunkSize = chunk instanceof Uint8Array ? chunk.length : chunk.size;
  if (BigInt(chunkSize) !== expectedSize) {
    throw new Error(
      `chunk size mismatch: got ${chunkSize} bytes, expected ${expectedSize} bytes`,
    );
  }

  const resp = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Range": `bytes ${start}-${end}/${totalSize}`,
      "Content-Length": String(expectedSize),
      "Content-Type": "application/octet-stream",
    },
    body: chunk instanceof Uint8Array ? (chunk.buffer as ArrayBuffer) : chunk,
  });

  switch (resp.status) {
    case 200:
    case 201:
    case 202:
      return true;
    case 416: {
      const body = await resp.text();
      throw new Error(`invalidRange: status ${resp.status}, response: ${body}`);
    }
    case 409: {
      const body = await resp.text();
      if (body.includes("resourceModified")) {
        throw new Error("resourceModified: session expired");
      }
      throw new Error(
        `conflict error: status ${resp.status}, response: ${body}`,
      );
    }
    default: {
      const body = await resp.text();
      throw new Error(
        `upload failed: status ${resp.status}, response: ${body}`,
      );
    }
  }
}

export async function getFileID(
  client: AzureClient,
  remoteFilePath: string,
): Promise<string> {
  await client.ensureTokenValid();

  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${remoteFilePath}`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
  });

  if (resp.status !== 200) {
    const body = await resp.text();
    throw new Error(
      `failed to fetch file metadata, status: ${resp.status}, response: ${body}`,
    );
  }

  const data = JSON.parse(await resp.text()) as { id: string };
  return data.id;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
