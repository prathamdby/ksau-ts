# PRD: ksau-ts — TypeScript + Bun Rewrite of ksau-go

## Introduction

Faithful 1:1 rewrite of `ksau-go` in TypeScript using Bun as the runtime and toolchain. The goal is
to produce a CLI tool called `ksau-ts` that is functionally identical to `ksau-go`: same commands,
same flags, same behavior, same output, same quirks. Nothing is to be fixed or improved — every
behavior in the Go version is intentional and must be preserved.

The new project lives in a **separate repository** (`ksau-ts`). Distribution is via Bun-compiled
standalone binaries shipped through a GitHub Actions release pipeline that mirrors the existing one.

---

## Goals

- Translate all Go source files to TypeScript with equivalent behavior, line by line where practical
- Use Commander.js as the CLI framework (mirrors Cobra's subcommand/flag model)
- Use native `fetch` for all HTTP calls (Bun has it built-in)
- Use `openpgp` npm package for PGP decrypt/encrypt (mirrors ProtonMail gopenpgp v3)
- Port QuickXorHash algorithm directly from Go to TypeScript (no npm substitute)
- Embed `privkey.pem` and `passphrase.txt` at build time using `Bun.embeddedFiles` (mirrors `//go:embed`)
- Inject `VERSION`, `COMMIT`, `DATE` at build time using `bun build --define` (mirrors Go ldflags)
- Produce standalone binaries for 5 platform/arch targets via `bun build --compile`
- Mirror the GitHub Actions release workflow (tag-triggered, secret injection, asset upload)

---

## Platform Target Mapping

| Go target     | Bun target              | Status   |
| ------------- | ----------------------- | -------- |
| linux/amd64   | `bun-linux-x64`         | Included |
| linux/arm64   | `bun-linux-arm64`       | Included |
| windows/amd64 | `bun-windows-x64`       | Included |
| darwin/amd64  | `bun-darwin-x64`        | Included |
| darwin/arm64  | `bun-darwin-arm64`      | Included |
| linux/arm     | ❌ Not supported by Bun | Dropped  |
| windows/arm64 | ❌ Not supported by Bun | Dropped  |
| freebsd/amd64 | ❌ Not supported by Bun | Dropped  |
| freebsd/arm64 | ❌ Not supported by Bun | Dropped  |
| openbsd/amd64 | ❌ Not supported by Bun | Dropped  |
| openbsd/arm64 | ❌ Not supported by Bun | Dropped  |

---

## Repository Layout

```
ksau-ts/
├── src/
│   ├── main.ts                     # Entry point → program.parse()
│   ├── cmd/
│   │   ├── root.ts                 # Root Commander program + --remote-config/-c global option
│   │   ├── upload.ts               # upload command + all flags + runUpload()
│   │   ├── quota.ts                # quota command + runQuota()
│   │   ├── refresh.ts              # refresh command + --url flag + runRefresh()
│   │   ├── listRemotes.ts          # list-remotes command + runListRemotes()
│   │   ├── version.ts              # version command + runVersion()
│   │   ├── help.ts                 # help command + all per-command help text
│   │   ├── utils.ts                # getConfigPath, getConfigData, getChunkSize,
│   │   │                           # selectRemoteAutomatically, verifyFileIntegrity, ANSI colors
│   │   └── progress/
│   │       └── progress.ts         # ProgressTracker class + 5 styles
│   ├── azure/
│   │   ├── client.ts               # AzureClient class + EnsureTokenValid (async mutex)
│   │   ├── config.ts               # parseRcloneConfigData, getAvailableRemotes, getRemoteConfig
│   │   ├── upload.ts               # upload(), createUploadSession(), uploadChunk(), getFileID()
│   │   ├── quota.ts                # getDriveQuota(), displayQuotaInfo(), formatBytes()
│   │   ├── hash.ts                 # getQuickXorHash()
│   │   ├── constants.ts            # KibiByte = 1024
│   │   ├── types.ts                # DriveQuota, UploadParams, ProgressCallback interfaces
│   │   └── item.ts                 # DriveItem type
│   └── crypto/
│       ├── algo.ts                 # encrypt(), decrypt() via openpgp
│       ├── quickxorhash.ts         # QuickXorHash class (port from Go)
│       └── placeholder.ts          # Bun.embeddedFiles access for privkey.pem + passphrase.txt
├── .github/
│   └── workflows/
│       └── release.yml             # Mirror of ksau-go release.yml, adapted for Bun
├── package.json                    # dependencies: commander, openpgp
├── tsconfig.json                   # strict mode, target ESNext, moduleResolution bundler
├── Makefile                        # build, build_gh_actions targets
└── .gitignore                      # *.conf, src/crypto/privkey.pem, passphrase.txt
```

---

## Development Conventions

### Commit Messages

All commits follow conventional commits format:

```
type: short summary (≤50 characters)

- Body bullet one
- Body bullet two
```

**Format rules:**

- First line: ≤50 characters — hard limit to avoid GitHub title truncation
- Mandatory blank line between subject and body
- Body bullets start with `-`; capitalize first word, no trailing period
- No scope notation — `feat:` not `feat(azure):`

**Type mapping for this project:**

| Type       | When to use                              | Example                                       |
| ---------- | ---------------------------------------- | --------------------------------------------- |
| `chore`    | Setup, build system, CI/CD, tooling      | `chore: init ksau-ts with Bun and TypeScript` |
| `feat`     | Any new source file ported from ksau-go  | `feat: port azure/config.ts`                  |
| `fix`      | Correction to a previous port            | `fix: correct QuickXorHash shift logic`       |
| `refactor` | Internal restructure, no behavior change | `refactor: extract chunk loop into helper`    |
| `docs`     | SPEC or README changes only              | `docs: update platform target table`          |
| `style`    | Formatting, whitespace, no logic change  | `style: normalize import order`               |
| `perf`     | Measurable performance improvement       | N/A — no optimization scope in this rewrite   |

**Commit workflow:**

1. `git diff --cached | cat` — review what is staged
2. Analyze the changes and select the appropriate type
3. `git commit -m "type: summary"` — subject only if body adds no value; include body for non-trivial changes

### Release Tagging

Releases are triggered by pushing a `v*.*.*-*` tag (e.g., `v1.0.0-r1`), which starts the GitHub Actions pipeline (US-023). Before tagging, update the `VERSION` file and land a `chore: release vX.Y.Z` commit so the tag points to a clean release state. The tag itself carries the version; the commit message documents intent.

---

## User Stories

### US-001: Initialize project structure

**Description:** As a developer, I need a new `ksau-ts` repository initialized with Bun, TypeScript, Commander.js, and openpgp so that I have a valid build environment.

**Commit:** `chore: init ksau-ts with Bun and TypeScript`

**Acceptance Criteria:**

- [ ] `package.json` present with `name: "ksau-ts"`, `type: "module"`, scripts `build` and `build:gh`
- [ ] `tsconfig.json` with `strict: true`, `target: "ESNext"`, `moduleResolution: "bundler"`
- [ ] `bun add commander openpgp` — both listed in `dependencies`
- [ ] `src/main.ts` exists with a minimal `program.parse()` entry point
- [ ] `bun run src/main.ts --help` exits 0 without errors
- [ ] `.gitignore` excludes `src/crypto/privkey.pem`, `src/crypto/passphrase.txt`, and `*.conf`

---

### US-002: Port `azure/constants.ts`

**Description:** As a developer, I need the `KibiByte` constant available so that chunk size calculations match Go exactly.

**Commit:** `feat: port azure/constants.ts`

**Acceptance Criteria:**

- [ ] `src/azure/constants.ts` exports `export const KibiByte = 1024`
- [ ] No other values added — exact mirror of `azure/constants.go`

---

### US-003: Port `azure/types.ts`

**Description:** As a developer, I need shared TypeScript types that mirror the Go type definitions.

**Commit:** `feat: port azure/types.ts and azure/item.ts`

**Acceptance Criteria:**

- [ ] `DriveQuota` interface: `{ total: bigint, used: bigint, remaining: bigint, deleted: bigint }`

  > Note: Go uses `int64`; use `bigint` in TypeScript to match 64-bit integers exactly.

- [ ] `ProgressCallback` type: `(uploadedBytes: bigint) => void`
- [ ] `UploadParams` interface:
  ```ts
  interface UploadParams {
    filePath: string;
    remoteFilePath: string;
    chunkSize: bigint;
    maxRetries: number;
    retryDelay: number; // milliseconds (converted from Go time.Duration)
    accessToken: string;
    progressCallback: ProgressCallback | null;
  }
  ```
- [ ] `src/azure/item.ts` exports `DriveItem` with at minimum `{ id: string }` (mirrors `azure/item.go`)

---

### US-004: Port `azure/config.ts`

**Description:** As a developer, I need rclone INI config parsing so that the tool can read remote configurations.

**Commit:** `feat: port azure/config.ts`

**Acceptance Criteria:**

- [ ] `parseRcloneConfigData(data: Uint8Array): Map<string, string>[]` — parses INI line-by-line
  - Each entry in the returned array is a `Map<string, string>` with a `remote_name` key set to the section name
  - Skips blank lines and lines starting with `#`
  - Handles `key = value` (trimmed) and `key =` (empty value) — exactly as Go's `strings.SplitN(line, "=", 2)`
  - Throws `Error` with message `"error parsing line N of rclone config"` on malformed lines
- [ ] `getAvailableRemotes(configs: Map<string, string>[]): string[]` — returns `remote_name` values in order
- [ ] `getRemoteConfig(configs: Map<string, string>[], remoteName: string): Map<string, string>` — throws if not found

---

### US-005: Port `azure/client.ts` — AzureClient class

**Description:** As a developer, I need the `AzureClient` class with OAuth2 token refresh so that API calls are authenticated.

**Commit:** `feat: port azure/client.ts with token refresh`

**Acceptance Criteria:**

- [ ] `AzureClient` class with fields: `clientId`, `clientSecret`, `accessToken`, `refreshToken`, `expiration` (Date), `driveId`, `driveType`, `remoteRootFolder`, `remoteBaseUrl`
- [ ] `static fromRcloneConfigData(data: Uint8Array, remoteName: string): AzureClient` — parses token JSON field exactly as Go: `{ access_token, refresh_token, expiry }` where expiry is RFC3339
- [ ] `async ensureTokenValid(): Promise<void>` — checks `Date.now() < this.expiration`, if expired posts to `https://login.microsoftonline.com/common/oauth2/v2.0/token` with `grant_type=refresh_token`; updates `accessToken`, `refreshToken`, `expiration`
- [ ] Token refresh is protected by an async mutex so that concurrent calls don't issue duplicate refreshes. Implement a simple promise-chaining mutex (a single `_refreshPromise: Promise<void> | null` field is sufficient — if non-null, await it instead of starting a new refresh)
- [ ] Token endpoint POST uses `application/x-www-form-urlencoded` body (mirrors Go's `url.Values`)
- [ ] On non-2xx refresh response: throws `Error("failed to refresh token, status code: N")`

---

### US-006: Port `azure/quota.ts`

**Description:** As a developer, I need quota fetching and display so that the `quota` command works.

**Commit:** `feat: port azure/quota.ts`

**Acceptance Criteria:**

- [ ] `AzureClient.getDriveQuota(): Promise<DriveQuota>` — calls `GET https://graph.microsoft.com/v1.0/me/drive/quota`, parses `{ total, used, remaining, deleted }` as bigint
- [ ] Calls `ensureTokenValid()` first
- [ ] On non-200: throws with message `"failed to fetch quota information, status: N, response: BODY"`
- [ ] `displayQuotaInfo(remote: string, quota: DriveQuota): void` — prints to stdout exactly:
  ```
  Remote: <name>
  Total:   <formatted>
  Used:    <formatted>
  Free:    <formatted>
  Trashed: <formatted>
  <blank line>
  ```
- [ ] `formatBytes(bytes: bigint): string` — mirrors Go's binary unit formatter with 3 decimal places: `"1.000 KiB"`, `"1.863 GiB"` etc.; `< 1024` prints `"N B"` (no decimals)

---

### US-007: Port `azure/hash.ts`

**Description:** As a developer, I need `getQuickXorHash` so that the upload command can verify file integrity.

**Commit:** `feat: port azure/hash.ts`

**Acceptance Criteria:**

- [ ] `AzureClient.getQuickXorHash(fileId: string): Promise<string>` — calls `GET https://graph.microsoft.com/v1.0/me/drive/items/{fileId}`, extracts `file.hashes.quickXorHash`
- [ ] Calls `ensureTokenValid()` first
- [ ] Throws `Error("quickXorHash not found in metadata")` if field is empty or missing
- [ ] On non-200: throws with message `"failed to fetch file metadata, status: N, response: BODY"`

---

### US-008: Port `azure/upload.ts` — chunk upload logic

**Description:** As a developer, I need the chunked upload implementation so that files are transferred to OneDrive.

**Commit:** `feat: port azure/upload.ts`

**Acceptance Criteria:**

- [ ] `AzureClient.upload(params: UploadParams): Promise<string>` — returns file ID on success
- [ ] Calls `ensureTokenValid()` before creating the upload session
- [ ] `createUploadSession(remoteFilePath: string): Promise<string>` — POST to `https://graph.microsoft.com/v1.0/me/drive/root:/{remoteFilePath}:/createUploadSession` with body `{ item: { "@microsoft.graph.conflictBehavior": "replace" } }`, returns `uploadUrl`
- [ ] Uses **a single worker** (sequential async for loop over chunk start positions — no parallel chunk uploads), mirroring Go's single-goroutine approach
- [ ] `uploadChunk(uploadUrl: string, chunk: Uint8Array, start: bigint, end: bigint, totalSize: bigint): Promise<boolean>` — PUT with `Content-Range: bytes START-END/TOTAL`, `Content-Length`, `Content-Type: application/octet-stream`
  - Returns `true` on HTTP 200/201/202
  - Throws `"invalidRange: status 416, response: BODY"` on HTTP 416
  - Throws `"resourceModified: session expired"` on HTTP 409 where body contains `"resourceModified"`
  - Throws `"conflict error: status 409, response: BODY"` on other 409s
  - Throws `"upload failed: status N, response: BODY"` on other failures
- [ ] Validates chunk parameters before PUT: start < 0 throws, end < start throws, chunk.length != (end-start+1) throws — mirroring Go validation
- [ ] Retry loop (up to `maxRetries`): on `resourceModified` or `invalidRange` errors, creates a new upload session before retrying
- [ ] Progress callback invoked after each successful chunk inside a mutex-free block (JS is single-threaded; no mutex needed for progress)
- [ ] `getFileID(remoteFilePath: string): Promise<string>` — GET `https://graph.microsoft.com/v1.0/me/drive/root:/{remoteFilePath}`, extracts `.id`
- [ ] After all chunks uploaded, calls `getFileID` to get the file ID and returns it
- [ ] On any chunk error after all retries: throws `"failed to upload chunk after N retries: CAUSE"`
- [ ] Prints to stdout (mirrors Go's `fmt.Println` calls exactly):
  - `"Starting file upload with upload session..."`
  - `"Upload session created successfully."`
  - `"File size: N bytes"`
  - `"Error uploading chunk START-END: CAUSE"` and `"Retrying chunk upload (attempt N/MAX)..."` on retry
  - `"Created new upload session after error"` on session regeneration
  - `"Failed to create new upload session: CAUSE"` if session regen itself fails

---

### US-009: Port `crypto/quickxorhash.ts`

**Description:** As a developer, I need the QuickXorHash algorithm ported from Go so that local file hashes can be computed.

**Commit:** `feat: port crypto/quickxorhash.ts`

**Acceptance Criteria:**

- [ ] `QuickXorHash` class implements the same algorithm as `crypto/quickxorhash.go` (ported from rclone/namazso)
  - Constants: `BlockSize = 64`, `Size = 20`, `shift = 11`, `widthInBits = 160`, `dataSize = 1760`
  - `data: Uint8Array` of length `dataSize`, `size: bigint`
  - `write(p: Uint8Array): void` — XOR bytes in circular-shifting fashion, exact port of Go's `Write`
  - `checkSum(): Uint8Array` — exact port of Go's `checkSum()`; returns 20-byte result
  - `sum(): Uint8Array` — returns `checkSum()` result (mirrors `Sum(nil)`)
  - `reset(): void` — zeroes `data` and `size`
- [ ] Static `sum(data: Uint8Array): Uint8Array` function — one-shot convenience (mirrors Go's package-level `Sum`)
- [ ] XOR helper: manually XOR `dst` with `src` (mirrors `subtle.XORBytes`; `Math.min(dst.length, src.length)` bytes)

---

### US-010: Port `crypto/placeholder.ts` — embedded key files

**Description:** As a developer, I need the private PGP key and passphrase embedded in the binary at build time so that config decryption works.

**Commit:** `feat: port crypto/placeholder.ts`

**Acceptance Criteria:**

- [ ] `src/crypto/placeholder.ts` reads embedded files using Bun's embedded file API:
  ```ts
  const privkeyFile = Bun.embeddedFiles["privkey.pem"];
  const passphraseFile = Bun.embeddedFiles["passphrase.txt"];
  ```
- [ ] Exports `privkey: string` (armored PGP key text) and `passphrase: string` (trimmed passphrase with no trailing newline)
- [ ] Both `src/crypto/privkey.pem` and `src/crypto/passphrase.txt` are in `.gitignore`
- [ ] Build command includes `--asset src/crypto/privkey.pem --asset src/crypto/passphrase.txt`

---

### US-011: Port `crypto/algo.ts` — PGP decrypt/encrypt

**Description:** As a developer, I need PGP decrypt and encrypt functions that use the embedded key so that the rclone config file can be read.

**Commit:** `feat: port crypto/algo.ts`

**Acceptance Criteria:**

- [ ] Uses `openpgp` npm package (OpenPGP.js v6)
- [ ] `decrypt(data: Uint8Array): Promise<Uint8Array>` — decrypts armored PGP message using the embedded private key and passphrase
  - Reads private key with `openpgp.readPrivateKey({ armoredKey: privkey })`
  - Decrypts key with `openpgp.decryptKey({ privateKey, passphrase })`
  - Reads message with `openpgp.readMessage({ armoredMessage: Buffer.from(data).toString() })`
  - Decrypts with `openpgp.decrypt({ message, decryptionKeys: privateKey, format: 'binary' })`
  - Returns decrypted bytes as `Uint8Array`
- [ ] `encrypt(text: string): Promise<Uint8Array>` — encrypts to armored PGP message using the embedded private key as recipient (mirrors Go's `Encrypt`)
- [ ] Panics (throws) with `"Failed to create private key"` if key parsing fails — mirroring Go's `panic`

---

### US-012: Port `cmd/progress/progress.ts`

**Description:** As a developer, I need the ProgressTracker class with all 5 styles so that upload progress is displayed correctly.

**Commit:** `feat: port cmd/progress/progress.ts`

**Acceptance Criteria:**

- [ ] `ProgressStyle` union type: `"basic" | "blocks" | "modern" | "emoji" | "minimal"`
- [ ] `validStyles(): ProgressStyle[]` returns `["basic", "blocks", "modern", "emoji", "minimal"]`
- [ ] `ProgressTracker` class with fields: `totalSize: bigint`, `uploadedSize: bigint`, `startTime: Date`, `lastUpdate: Date`, `style: ProgressStyle`, `customEmoji: string`, `width: number` (default 40), `lastChunkSize: bigint`, `lastSpeed: number`
- [ ] `constructor(totalSize: bigint, style: ProgressStyle)` — sets `startTime = lastUpdate = new Date()`, `customEmoji = "🟦"`, `width = 40`
- [ ] `updateProgress(uploadedSize: bigint): void` — computes speed only when elapsed >= 1 second (matches Go's `if elapsed >= 1.0`), then calls `displayProgress()`
- [ ] `displayProgress()` — writes `\r\x1b[K<progressBar>` to stdout (no newline)
- [ ] `finish()` — calls `updateProgress(totalSize)` then writes `\n`
- [ ] Style rendering matches Go exactly:
  - `basic`: `[{fill}>{ spaces}] {pct}% | {speed}/s` where fill is `=` repeated, width accounts for brackets
  - `blocks`: `{█ repeated}{░ repeated} {pct}% | {speed}/s`
  - `modern`: `{● repeated}{○ repeated} {pct}% | {speed}/s`
  - `emoji`: `{emoji repeated}{⬜ repeated} {pct}% | {speed}/s` — width is `p.Width / 2`; default emoji is `🟦`; empty string defaults to `🟦`
  - `minimal`: `{pct}% | {speed}/s | {uploaded}/{total} | ETA: {duration}`
- [ ] `formatBytes(bytes: number): string` — binary units, 1 decimal place: `"1.1 KiB"`, fallback `"N.N B"` (mirrors Go's progress formatBytes exactly — note this is different from `azure/quota.ts`'s formatBytes which uses 3 decimal places and bigint)
- [ ] `formatDuration(ms: number): string` — rounds to second, produces `Nh Nm Ns` / `Nm Ns` / `Ns` (mirrors Go's `formatDuration`)

---

### US-013: Port `cmd/utils.ts`

**Description:** As a developer, I need config path resolution, config reading, chunk size selection, remote auto-selection, and file integrity verification so that the upload command works end-to-end.

**Commit:** `feat: port cmd/utils.ts`

**Acceptance Criteria:**

- [ ] ANSI color constants exported: `ColorReset = "\x1b[0m"`, `ColorRed = "\x1b[31m"`, `ColorGreen = "\x1b[32m"`, `ColorYellow = "\x1b[33m"`
- [ ] `getConfigPath(): string` — mirrors Go platform logic exactly:
  - `android | linux | freebsd | openbsd | darwin` → `~/.ksau/.conf/rclone.conf`
  - `windows` → `%APPDATA%\ksau\.conf\rclone.conf`
  - Other → throws `Error("unsupported OS: PLATFORM")`
  - Creates directory with `mkdirSync(..., { recursive: true })` before returning
  - Uses `process.platform` for OS detection (maps `win32` → windows, `darwin` → darwin, `linux` → linux)
- [ ] `getConfigData(): Promise<Uint8Array>` — reads file at `getConfigPath()`, decrypts with `crypto.decrypt()`, returns plaintext bytes
- [ ] `getChunkSize(fileSize: bigint): bigint` — exact port of Go logic:
  - `mb5 = 16n * 320n * KibiByte` → files < 100MB
  - `mb10 = 32n * 320n * KibiByte` → files < 1GB
  - `mb25 = 80n * 320n * KibiByte` → files >= 1GB
  - Thresholds: `mb100 = 100n * 1024n * 1024n`, `gb1 = 1024n * 1024n * 1024n`
- [ ] `selectRemoteAutomatically(fileSize: bigint, progressStyle: ProgressStyle): Promise<string>` — mirrors Go exactly:
  - Reads config, parses, gets available remotes
  - Prints `"Checking free spaces for each remote..."` (no newline — `process.stdout.write`)
  - Fires all remote quota checks **in parallel** using `Promise.all` (mirrors Go's `sync.WaitGroup` goroutines)
  - Shows a progress tracker updating as each remote check completes (increment `done` counter; call `progressTracker.updateProgress(done)`)
  - After all done, clears line with `process.stdout.write("\x1b[2K\r")`
  - If no remotes responded, throws `Error("cannot get remote with the most free space: all remote were not available")`
  - Selects remote with maximum `remaining` space
  - Prints `"Using remote with the most free space: REMOTE"` then returns remote name
  - Quota fetch HTTP client uses 10-second timeout (`AbortSignal.timeout(10000)`)
  - Silent on per-remote errors (same as Go's `return` in goroutine)
- [ ] `verifyFileIntegrity(filePath: string, fileId: string, client: AzureClient): Promise<void>` — mirrors Go exactly:
  - Prints `"Verifying file integrity..."`
  - Retries `getQuickXorHash` up to `hashRetries` times with `hashRetryDelay` ms between attempts
  - Opens file, streams through `QuickXorHash`, base64-encodes result
  - Prints colored success/failure message (green or red)
  - All failure paths print yellow warning and return — never throws

---

### US-014: Port `cmd/root.ts` — root Commander program

**Description:** As a developer, I need the root Commander program with the global `--remote-config` / `-c` flag so that all subcommands can access it.

**Commit:** `feat: port cmd/root.ts`

**Acceptance Criteria:**

- [ ] Creates and exports a `program` Commander instance
- [ ] `.name("ksau-ts")` (name changed from ksau-go)
- [ ] `.description(...)` matching Go's root Long description
- [ ] `.option("-c, --remote-config <name>", "Name of the remote configuration section in rclone.conf")`
- [ ] On unhandled error, prints error and `process.exit(1)` — matching Go's `rootCmd.Execute()` behavior

---

### US-015: Port `cmd/version.ts`

**Description:** As a developer, I need the `version` subcommand so that build metadata can be inspected.

**Commit:** `feat: port cmd/version.ts`

**Acceptance Criteria:**

- [ ] `program.command("version")` with Short and Long matching Go
- [ ] Reads `VERSION`, `COMMIT`, `DATE` injected at build time via `--define`:
  ```ts
  declare const BUILD_VERSION: string;
  declare const BUILD_COMMIT: string;
  declare const BUILD_DATE: string;
  ```
  Defaults: `BUILD_VERSION = "1.0.0"`, `BUILD_COMMIT = "none"`, `BUILD_DATE = "unknown"`
- [ ] Prints:
  ```
  ksau-ts vVERSION
  Commit: COMMIT
  Built: DATE
  ```

---

### US-016: Port `cmd/refresh.ts`

**Description:** As a developer, I need the `refresh` subcommand so that the encrypted rclone config can be re-downloaded.

**Commit:** `feat: port cmd/refresh.ts`

**Acceptance Criteria:**

- [ ] `program.command("refresh")` with Short/Long matching Go
- [ ] `.option("-u, --url <url>", "Sets a custom url (must be direct.)")`
- [ ] Default URL constant: `"https://raw.githubusercontent.com/global-index-source/creds/main/rclone.conf.asc"`
- [ ] Prints `"fetching rclone config from URL"` before fetching
- [ ] On fetch error: prints `"failed to fetch config file: CAUSE"` then `process.exit(1)`
- [ ] On body read error: prints `"something is wrong with the response: CAUSE"` then `process.exit(1)`
- [ ] Prints `"writing config file to PATH"` before writing
- [ ] Writes raw response body bytes to config path (no decryption — it stores the encrypted file as-is)
- [ ] Uses `getConfigPath()` to determine write path

---

### US-017: Port `cmd/listRemotes.ts`

**Description:** As a developer, I need the `list-remotes` subcommand so that available remote names can be inspected.

**Commit:** `feat: port cmd/listRemotes.ts`

**Acceptance Criteria:**

- [ ] `program.command("list-remotes")` with Short/Long matching Go
- [ ] Prints `"reading configuration file..."`
- [ ] On config read failure: prints error, `process.exit(1)`
- [ ] On parse failure: prints error, `process.exit(1)`
- [ ] Prints `"available remotes: [name1, name2, ...]"` — matching Go's `fmt.Println("available remotes:", availableRemotes)`

---

### US-018: Port `cmd/quota.ts`

**Description:** As a developer, I need the `quota` subcommand so that storage usage across all remotes can be displayed.

**Commit:** `feat: port cmd/quota.ts`

**Acceptance Criteria:**

- [ ] `program.command("quota")` with Short/Long matching Go
- [ ] Reads config, parses, gets all remotes
- [ ] Fires all remote quota checks **in parallel** using `Promise.all` (mirrors Go's `sync.WaitGroup` goroutines)
- [ ] Uses `AbortSignal.timeout(10000)` for the quota HTTP client (10-second timeout matching Go's `Timeout: 10 * time.Second`)
- [ ] On client init failure: prints `"Failed to initialize client for remote 'NAME': CAUSE"`, sets exit code 1
- [ ] On quota fetch failure: prints `"Failed to fetch quota information for remote 'NAME': CAUSE"`, sets exit code 1
- [ ] On success: calls `displayQuotaInfo(remoteName, quota)` for each remote
- [ ] After all goroutine-equivalents settle: if any failed, `process.exit(1)` — mirrors Go's atomic exit code

---

### US-019: Port `cmd/help.ts`

**Description:** As a developer, I need the custom `help` subcommand with per-command help text.

**Commit:** `feat: port cmd/help.ts`

**Acceptance Criteria:**

- [ ] `program.command("help [command]")` with Short/Long matching Go
- [ ] With no argument: prints the full help overview text matching Go's output exactly (same headers, same examples, just with `ksau-ts` instead of `ksau-go`)
- [ ] With argument `upload`: prints `printUploadHelp()` — matches Go's multiline string verbatim (with `ksau-ts`)
- [ ] With argument `quota`: prints `printQuotaHelp()` — matches Go's text verbatim
- [ ] With argument `version`: prints `printVersionHelp()` — matches Go's text verbatim
- [ ] With argument `refresh`: prints `printRefreshHelp()` — matches Go's text verbatim
- [ ] With argument `list-remote`: prints `printListRemoteHelp()` — matches Go's text verbatim
- [ ] With unknown argument: prints `"Unknown command: NAME"`

---

### US-020: Port `cmd/upload.ts`

**Description:** As a developer, I need the `upload` subcommand — the primary command of the tool.

**Commit:** `feat: port cmd/upload.ts`

**Acceptance Criteria:**

- [ ] `program.command("upload")` with Short/Long matching Go
- [ ] Required flags: `-f, --file <path>`, `-r, --remote <folder>`
- [ ] Optional flags with identical defaults and descriptions:
  - `-n, --remote-name <name>` — defaults to local filename
  - `-s, --chunk-size <bytes>` (number, default 0 → auto)
  - `--retries <n>` (number, default 3)
  - `--retry-delay <ms>` (number, default 5000 — note Go default is 5s)
  - `--skip-hash` (boolean, default false)
  - `--hash-retries <n>` (number, default 5)
  - `--hash-retry-delay <ms>` (number, default 10000 — note Go default is 10s)
  - `--progress <style>` (string, default "modern") — multi-line description matching Go's flag help
  - `--emoji <emoji>` (string, default "🟦") — description matching Go's flag help
- [ ] Validates progress style: if invalid, prints `"Invalid progress style: STYLE\nValid styles are: basic, blocks, modern, emoji, minimal"` and returns (no exit, matching Go's plain `return`)
- [ ] Gets `fileSize` via `statSync(filePath).size` (as bigint)
- [ ] Reads `--remote-config` from parent program options; if not set calls `selectRemoteAutomatically(fileSize, progressStyle)`
- [ ] On auto-remote failure: prints `"cannot automatically determine remote to be used: CAUSE"` then `process.exit(1)`
- [ ] Chunk size selection logic — exact port:
  - If `chunkSize == 0`: auto-select and print `"Selected chunk size: N bytes (based on file size: M bytes)"`
  - If `chunkSize > maxChunkSize (50 MiB = 160 * 320 * KibiByte)`: reduce and print `"Warning: Reducing chunk size from N to M bytes for reliability"`
  - If `chunkSize % (320 * KibiByte) != 0`: print `"Warning: Chunk size N is not multiple of 320KiB, upload may not be optimal"`
  - Otherwise: print `"Using user-specified chunk size: N bytes"`
- [ ] Constructs `fullRemotePath = path.join(rootFolder, remoteFolder, fileName)` — mirrors Go's `filepath.Join(rootFolder, remoteFilePath)`
- [ ] Prints `"Full remote path: PATH"`
- [ ] Sets up progress tracker and progress callback:
  - If `NewProgressTracker` returns a tracker, wraps `updateProgress()` call in `try/catch`; on exception prints `"\nWarning: Progress update failed: CAUSE"` and sets tracker to null — mirroring Go's `recover()` behavior
  - Acquires no mutex (JS single-threaded — the Go mutex here was only for safety; omit)
- [ ] HTTP fetch timeout: 120 seconds (`AbortSignal.timeout(120000)`) — mirrors Go's `http.Client{Timeout: 120 * time.Second}`
- [ ] On upload success (`fileID != ""`):
  - Calls `tracker.updateProgress(fileSize)` then `tracker.finish()`
  - Prints `"\nFile uploaded successfully."`
  - Constructs download URL: `baseURL + "/" + urlPath` where `urlPath` has backslashes replaced with `/` and spaces replaced with `%20`
  - If `remoteFileName != ""`, uses `path.join(remoteFolder, remoteFileName)` for `urlPath`, else uses `path.join(remoteFolder, localFileName)`
  - Prints `"\x1b[32mDownload URL:\x1b[0m \x1b[32mURL\x1b[0m"` — matching Go's ColorGreen formatting
  - If `!skipHash`: calls `verifyFileIntegrity(filePath, fileID, client)`
- [ ] On upload failure (`fileID == ""`):
  - Calls `tracker.finish()`
  - Prints `"\nFile upload failed."`
- [ ] On upload exception:
  - Calls `tracker.finish()`
  - Prints `"\nFailed to upload file: CAUSE"`

---

### US-021: Port `src/main.ts` — entry point

**Description:** As a developer, I need the entry point that wires all subcommands and parses argv.

**Commit:** `feat: port src/main.ts entry point`

**Acceptance Criteria:**

- [ ] Imports all command registration functions from `cmd/` and registers them on the root `program`
- [ ] Calls `program.parse(process.argv)`
- [ ] On Commander error, `process.exit(1)` — matching Go's behavior

---

### US-022: Build system — Makefile and package.json scripts

**Description:** As a developer, I need build scripts that produce standalone Bun binaries with embedded assets and version info injected.

**Commit:** `chore: add Makefile and package.json build scripts`

**Acceptance Criteria:**

- [ ] `package.json` `scripts.build` runs a local development build (no `--compile`, no assets needed)
- [ ] `package.json` `scripts.build:gh` runs the multi-platform GitHub Actions build (with assets + compile)
- [ ] `Makefile` `build` target:
  ```makefile
  build:
    bun build --compile --minify \
      --asset src/crypto/privkey.pem \
      --asset src/crypto/passphrase.txt \
      --define BUILD_VERSION=\"$(VERSION)\" \
      --define BUILD_COMMIT=\"$(COMMIT)\" \
      --define BUILD_DATE=\"$(DATE)\" \
      --outfile ksau-ts \
      src/main.ts
  ```
- [ ] `Makefile` `build_gh_actions` target builds all 5 Bun targets:
  - `bun-linux-x64` → `ksau-ts-linux-x64`
  - `bun-linux-arm64` → `ksau-ts-linux-arm64`
  - `bun-windows-x64` → `ksau-ts-windows-x64.exe`
  - `bun-darwin-x64` → `ksau-ts-darwin-x64`
  - `bun-darwin-arm64` → `ksau-ts-darwin-arm64`
- [ ] `Makefile` `version` target prints `Version: X.Y.Z` (for CI to grep)
- [ ] Version is read from a `VERSION` file or hardcoded in Makefile

---

### US-023: GitHub Actions release workflow

**Description:** As a developer, I need a GitHub Actions workflow that mirrors `ksau-go`'s release pipeline, adapted for Bun.

**Commit:** `chore: add GitHub Actions release workflow`

> **Release flow:** After all `feat:` port commits land and the `VERSION` file is updated, cut a `chore: release vX.Y.Z` commit, then push the `v*.*.*-*` tag. The tag triggers this workflow.

**Acceptance Criteria:**

- [ ] `.github/workflows/release.yml` triggers on `push.tags: "v*.*.*-*"`
- [ ] Sets up Bun (uses `oven-sh/setup-bun@v2`)
- [ ] Installs dependencies: `bun install`
- [ ] Injects secrets: downloads `privkey.pem` from `PRIVATE_GPG_KEY_GIST_URL`, writes `passphrase.txt` from `PRIVATE_PGP_KEY_PASSPHRASE` (same as ksau-go, same secret names)
- [ ] Strips trailing newline from `passphrase.txt` (`tr -d '\n'` — exact same as Go workflow)
- [ ] Validates secrets are non-empty before proceeding (same guard as Go workflow)
- [ ] Runs `Makefile build_gh_actions` to produce all 5 binaries
- [ ] Deletes `privkey.pem` and `passphrase.txt` after build
- [ ] Extracts VERSION/COMMIT/DATE the same way as Go workflow (Makefile `version` target + `git rev-parse --short HEAD` + `date -u`)
- [ ] Creates GitHub release using `softprops/action-gh-release@v1`
- [ ] Uploads all 5 binary assets using `actions/upload-release-asset@v1`

---

## Functional Requirements

- FR-1: All 6 subcommands (`upload`, `quota`, `refresh`, `list-remotes`, `version`, `help`) must be present with identical CLI surface (flags, defaults, help text, output)
- FR-2: Config file path must be platform-specific: `~/.ksau/.conf/rclone.conf` on Unix-like systems, `%APPDATA%\ksau\.conf\rclone.conf` on Windows
- FR-3: Config file is read as PGP-armored encrypted data and decrypted in memory; plaintext never written to disk
- FR-4: Private PGP key and passphrase must be embedded in the binary at build time — not read from the filesystem at runtime
- FR-5: Token refresh must prevent concurrent fetch calls from issuing duplicate OAuth2 refresh requests
- FR-6: Upload uses a single-worker sequential loop — no parallel chunk uploads
- FR-7: On `resourceModified` or `invalidRange` error during upload, a new upload session is created before retrying
- FR-8: QuickXorHash algorithm must be a direct port — no npm package substitution
- FR-9: All chunk size arithmetic must use `bigint` to avoid precision loss on large files (>= 2^53 bytes)
- FR-10: Progress callback panic recovery must be mirrored: catch exception, print warning, set tracker to null, continue
- FR-11: `quota` and `selectRemoteAutomatically` must issue all remote checks concurrently (Promise.all), not sequentially
- FR-12: `quota` command must exit with code 1 if any remote check fails — matching Go's atomic exit code behavior
- FR-13: `selectRemoteAutomatically` must be silent on per-remote failures (no error logged) — matching Go's `return` in goroutine
- FR-14: Download URL must replace backslashes with `/` and spaces with `%20` before printing — matching Go's string manipulation
- FR-15: Binary output filenames use `ksau-ts` prefix (not `ksau-go`)
- FR-16: The `version` command prints `ksau-ts vVERSION` (not `ksau-go`)
- FR-17: Help text updates `ksau-go` references to `ksau-ts`; all other text is verbatim

---

## Non-Goals

- No bug fixes — all behaviors from ksau-go are intentional and must be preserved
- No test suite — ksau-go has none; ksau-ts will have none
- No env var config support — file-only, matching ksau-go
- No parallel chunk uploads — single-worker is intentional per ksau-go design
- No linux/arm, windows/arm64, freebsd, or openbsd targets — Bun does not support them
- No changes to the rclone config format or field names
- No changes to the remote selection strategy (max free space, always — random selection was commented out in Go and stays commented out)
- No logging framework — all output via `console.log` / `process.stdout.write` matching Go's `fmt.Println` / `fmt.Printf`

---

## Technical Considerations

- **Default rclone config URL**: The `refresh` command downloads the encrypted rclone config from:
  `https://raw.githubusercontent.com/global-index-source/creds/main/rclone.conf.asc`
  This is hardcoded as the default in `cmd/refresh.ts` and overridable via `--url`. The file is PGP-armored and written as-is to disk — decryption happens at read time, not here.

- **bigint vs number**: Use `bigint` for all byte counts, chunk positions, and quota values to match Go's `int64`. Use `number` only for speeds, percentages, and elapsed time in the progress tracker.
- **Async mutex for token refresh**: JS is single-threaded but `await` yields control. Implement with a cached promise: `if (this._refreshPromise) return this._refreshPromise; this._refreshPromise = this._doRefresh().finally(() => { this._refreshPromise = null })`.
- **`path.join` vs `path.posix.join`**: On Windows, `path.join` uses backslashes. The download URL construction already replaces backslashes with `/`, so use the platform-native `path.join` (import from `"node:path"`) — exactly as Go uses `filepath.Join`.
- **`Bun.embeddedFiles`**: Only available in `bun build --compile` output. During development (`bun run src/main.ts`), the crypto files must exist at `src/crypto/privkey.pem` and `src/crypto/passphrase.txt` on disk. `Bun.embeddedFiles` falls back to reading the asset path on disk in dev mode.
- **openpgp v6 API**: Use `openpgp.readPrivateKey`, `openpgp.decryptKey`, `openpgp.readMessage`, `openpgp.decrypt`. The `format: 'binary'` option returns `Uint8Array`.
- **HTTP fetch timeout**: Use `fetch(url, { signal: AbortSignal.timeout(ms) })`. This is available in Bun natively.
- **`process.platform`**: Maps to `"linux"`, `"darwin"`, `"win32"`, `"android"`, `"freebsd"`. The config path function must map `"win32"` → windows logic, `"darwin" | "linux" | "freebsd" | "android"` → Unix logic. Note `"openbsd"` is not a valid `process.platform` value in Node/Bun but include it in the string check to match Go's intent.

---

## Success Metrics

- Running `ksau-ts upload -f FILE -r FOLDER` produces the same output lines (in the same order) as `ksau-go upload -f FILE -r FOLDER`
- Running `ksau-ts quota` produces the same per-remote output as `ksau-go quota`
- Running `ksau-ts version` prints `ksau-ts vVERSION` with correct injected values
- Binary size is reasonable for a Bun-compiled binary (expected: 50–120MB due to Bun runtime embedding)
- All 5 platform binaries are produced and uploaded in the GitHub Actions release
- All commits follow the conventional commit format with subject lines ≤50 characters

---

## Open Questions

- None — user confirmed: "translate without losing functionality or fixing anything; everything right now is intentional."
