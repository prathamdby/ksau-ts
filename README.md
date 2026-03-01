# ksau-ts

TypeScript + Bun rewrite of [ksau-go](https://github.com/global-index-source/ksau-go). Faithful 1:1
port — same commands, same flags, same output, same behavior.

## Requirements

- [Bun](https://bun.sh) ≥ 1.0
- A valid rclone config at the platform-specific path (see [Configuration](#configuration))

## Installation

Download a pre-built binary from [Releases](../../releases) for your platform:

| Platform     | Binary                    |
| ------------ | ------------------------- |
| Linux x64    | `ksau-ts-linux-x64`       |
| Linux arm64  | `ksau-ts-linux-arm64`     |
| Windows x64  | `ksau-ts-windows-x64.exe` |
| macOS x64    | `ksau-ts-darwin-x64`      |
| macOS arm64  | `ksau-ts-darwin-arm64`    |

## Usage

```
ksau-ts [global flags] <command> [flags]

Global flags:
  -c, --remote-config <name>   Name of the remote configuration section in rclone.conf
```

### Commands

#### upload

Upload a file to OneDrive.

```
ksau-ts upload -f <file> -r <remote-folder> [flags]

Required:
  -f, --file <path>       Local file to upload
  -r, --remote <folder>   Remote folder on OneDrive

Optional:
  -n, --remote-name <name>        Remote filename (defaults to local filename)
  -s, --chunk-size <bytes>        Chunk size in bytes (0 = auto, default: 0)
      --retries <n>               Max chunk upload retries (default: 3)
      --retry-delay <ms>          Delay between retries in ms (default: 5000)
      --skip-hash                 Skip QuickXorHash verification
      --hash-retries <n>          Max hash fetch retries (default: 5)
      --hash-retry-delay <ms>     Delay between hash retries in ms (default: 10000)
      --progress <style>          Progress style: basic|blocks|modern|emoji|minimal (default: modern)
      --emoji <emoji>             Custom emoji for emoji style (default: 🟦)
```

Examples:

```sh
# Upload to root
ksau-ts upload -f myfile.txt -r /

# Upload with custom remote name
ksau-ts upload -f local.txt -r /docs -n remote.txt

# Upload with specific chunk size
ksau-ts upload -f large.zip -r /backup -s 8388608

# Upload using a specific remote
ksau-ts upload -f file.pdf -r /shared --remote-config saurajcf
```

#### quota

Display OneDrive quota for all configured remotes.

```sh
ksau-ts quota
ksau-ts quota --remote-config oned
```

#### refresh

Re-download the encrypted rclone config from the default or a custom URL.

```sh
ksau-ts refresh
ksau-ts refresh --url https://example.com/rclone.conf.asc
```

#### list-remotes

List available remote names from the config file.

```sh
ksau-ts list-remotes
```

#### version

Print version, commit, and build date.

```sh
ksau-ts version
```

#### help

Print detailed help for a specific command.

```sh
ksau-ts help
ksau-ts help upload
ksau-ts help quota
```

## Configuration

The tool reads an encrypted rclone config file from:

| Platform | Path                                |
| -------- | ----------------------------------- |
| Linux / macOS / Android | `~/.ksau/.conf/rclone.conf` |
| Windows  | `%APPDATA%\ksau\.conf\rclone.conf`  |

Use `ksau-ts refresh` to download the config.

## Building from Source

Requires `src/crypto/privkey.pem` and `src/crypto/passphrase.txt` (gitignored).

```sh
# Install dependencies
bun install

# Dev run (no compile)
bun run src/main.ts --help

# Local binary
make build

# All 5 platform targets (for CI)
make build_gh_actions
```

## Development

```sh
bun run lint       # Biome lint + format check
bun run typecheck  # TypeScript type check
```

## Release

Releases are triggered by pushing a `v*.*.*-*` tag. The GitHub Actions workflow builds all 5
platform binaries and uploads them to the release.

```sh
# Update VERSION file, then:
git commit -m "chore: release vX.Y.Z"
git tag vX.Y.Z-r1
git push origin vX.Y.Z-r1
```
