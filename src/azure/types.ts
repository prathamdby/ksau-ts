export interface DriveQuota {
  total: bigint;
  used: bigint;
  remaining: bigint;
  deleted: bigint;
}

export type ProgressCallback = (uploadedBytes: bigint) => void;

export interface UploadParams {
  filePath: string;
  remoteFilePath: string;
  chunkSize: bigint;
  maxRetries: number;
  retryDelay: number;
  accessToken: string;
  progressCallback: ProgressCallback | null;
}
