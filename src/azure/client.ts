import { parseRcloneConfigData } from "./config.ts";
import { getDriveQuota } from "./quota.ts";
import { upload } from "./upload.ts";
import { getQuickXorHash } from "./hash.ts";
import type { DriveQuota, UploadParams } from "./types.ts";

export class AzureClient {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  expiration: Date;
  driveId: string;
  driveType: string;
  remoteRootFolder: string;
  remoteBaseUrl: string;

  private _refreshPromise: Promise<void> | null = null;

  constructor(
    clientId: string,
    clientSecret: string,
    accessToken: string,
    refreshToken: string,
    expiration: Date,
    driveId: string,
    driveType: string,
    remoteRootFolder: string,
    remoteBaseUrl: string,
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiration = expiration;
    this.driveId = driveId;
    this.driveType = driveType;
    this.remoteRootFolder = remoteRootFolder;
    this.remoteBaseUrl = remoteBaseUrl;
  }

  static fromRcloneConfigData(
    data: Uint8Array,
    remoteName: string,
  ): AzureClient {
    const configMaps = parseRcloneConfigData(data);

    let configMap: Map<string, string> | undefined;
    for (const elem of configMaps) {
      if (elem.get("remote_name") === remoteName) {
        configMap = elem;
      }
    }

    if (!configMap) {
      throw new Error(`remote ${remoteName} does not exist`);
    }

    const clientId = configMap.get("client_id") ?? "";
    const clientSecret = configMap.get("client_secret") ?? "";
    const remoteRootFolder = configMap.get("root_folder") ?? "";
    const remoteBaseUrl = configMap.get("base_url") ?? "";

    const tokenRaw = configMap.get("token") ?? "{}";
    const tokenData = JSON.parse(tokenRaw) as {
      access_token?: string;
      refresh_token?: string;
      expiry?: string;
    };

    const accessToken = tokenData.access_token ?? "";
    const refreshToken = tokenData.refresh_token ?? "";

    if (!tokenData.expiry) {
      throw new Error("failed to parse token expiration time: missing expiry");
    }
    const expiration = new Date(tokenData.expiry);
    if (isNaN(expiration.getTime())) {
      throw new Error(
        `failed to parse token expiration time: invalid date ${tokenData.expiry}`,
      );
    }

    const driveId = configMap.get("drive_id") ?? "";
    const driveType = configMap.get("drive_type") ?? "";

    return new AzureClient(
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
      expiration,
      driveId,
      driveType,
      remoteRootFolder,
      remoteBaseUrl,
    );
  }

  async ensureTokenValid(): Promise<void> {
    if (Date.now() < this.expiration.getTime()) {
      return;
    }

    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    this._refreshPromise = this._doRefresh().finally(() => {
      this._refreshPromise = null;
    });

    return this._refreshPromise;
  }

  private async _doRefresh(): Promise<void> {
    const tokenURL =
      "https://login.microsoftonline.com/common/oauth2/v2.0/token";

    const params = new URLSearchParams();
    params.set("client_id", this.clientId);
    params.set("client_secret", this.clientSecret);
    params.set("refresh_token", this.refreshToken);
    params.set("grant_type", "refresh_token");

    const res = await fetch(tokenURL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      throw new Error(`failed to refresh token, status code: ${res.status}`);
    }

    const responseData = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    this.accessToken = responseData.access_token;
    this.refreshToken = responseData.refresh_token;
    this.expiration = new Date(Date.now() + responseData.expires_in * 1000);
  }

  getDriveQuota(signal?: AbortSignal): Promise<DriveQuota> {
    return getDriveQuota(this, signal);
  }

  upload(params: UploadParams): Promise<string> {
    return upload(this, params);
  }

  getQuickXorHash(fileId: string): Promise<string> {
    return getQuickXorHash(this, fileId);
  }
}
