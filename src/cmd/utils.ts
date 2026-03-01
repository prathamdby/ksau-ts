import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { AzureClient } from '../azure/client.ts'
import { parseRcloneConfigData, getAvailableRemotes } from '../azure/config.ts'
import { KibiByte } from '../azure/constants.ts'
import { decrypt } from '../crypto/algo.ts'
import { QuickXorHash } from '../crypto/quickxorhash.ts'
import { ProgressTracker, type ProgressStyle } from './progress/progress.ts'

const hashRetries = 5
const hashRetryDelay = 10000

export const ColorReset = '\x1b[0m'
export const ColorRed = '\x1b[31m'
export const ColorGreen = '\x1b[32m'
export const ColorYellow = '\x1b[33m'

export function getConfigPath(): string {
  const platform = process.platform
  let configDir: string

  if (platform === 'win32') {
    configDir = path.join(process.env.APPDATA || '', 'ksau', '.conf')
  } else if (
    platform === 'android' ||
    platform === 'linux' ||
    platform === 'freebsd' ||
    platform === 'openbsd' ||
    platform === 'darwin'
  ) {
    configDir = path.join(os.homedir(), '.ksau', '.conf')
  } else {
    throw new Error('unsupported OS: ' + platform)
  }

  fs.mkdirSync(configDir, { recursive: true })
  return path.join(configDir, 'rclone.conf')
}

export async function getConfigData(): Promise<Uint8Array> {
  const configPath = getConfigPath()
  const data = fs.readFileSync(configPath)
  return await decrypt(new Uint8Array(data))
}

export function getChunkSize(fileSize: bigint): bigint {
  const mb5 = 16n * 320n * KibiByte
  const mb10 = 32n * 320n * KibiByte
  const mb25 = 80n * 320n * KibiByte
  const mb100 = 100n * 1024n * 1024n
  const gb1 = 1024n * 1024n * 1024n

  if (fileSize < mb100) {
    return mb5
  } else if (fileSize < gb1) {
    return mb10
  } else {
    return mb25
  }
}

export async function selectRemoteAutomatically(
  fileSize: bigint,
  progressStyle: ProgressStyle
): Promise<string> {
  const rcloneConfigData = await getConfigData()
  const parsedRcloneConfigData = parseRcloneConfigData(rcloneConfigData)
  const availRemotes = getAvailableRemotes(parsedRcloneConfigData)

  process.stdout.write('Checking free spaces for each remote...')
  const tracker = new ProgressTracker(BigInt(availRemotes.length), progressStyle)

  let done = 0
  const remoteAndSpace = new Map<string, bigint>()

  await Promise.all(
    availRemotes.map(async (remote) => {
      try {
        const client = await AzureClient.fromRcloneConfigData(rcloneConfigData, remote)
        const quota = await Promise.race([
          client.getDriveQuota(),
          new Promise<never>((_, reject) =>
            AbortSignal.timeout(10000).addEventListener('abort', () =>
              reject(new Error('timeout'))
            )
          ),
        ])
        remoteAndSpace.set(remote, quota.remaining)
      } catch {
        // ignore that remote
      }
      done++
      tracker.updateProgress(BigInt(done))
    })
  )

  process.stdout.write('\x1b[2K\r')

  if (remoteAndSpace.size === 0) {
    throw new Error(
      'cannot get remote with the most free space: all remote were not available'
    )
  }

  let selectedRemote = availRemotes[0]
  let maxSpace = -1n
  for (const [remote, space] of remoteAndSpace) {
    if (space > maxSpace) {
      maxSpace = space
      selectedRemote = remote
    }
  }

  console.log('Using remote with the most free space:', selectedRemote)
  return selectedRemote
}

export async function verifyFileIntegrity(
  filePath: string,
  fileId: string,
  client: AzureClient
): Promise<void> {
  console.log('Verifying file integrity...')

  let fileHash = ''
  let lastErr: unknown

  for (let i = 0; i < hashRetries; i++) {
    try {
      fileHash = await client.getQuickXorHash(fileId)
      lastErr = undefined
      break
    } catch (err) {
      lastErr = err
      console.log(
        `Attempt ${i + 1}/${hashRetries}: Failed to get file hash: ${(err as Error).message}`
      )
      if (i < hashRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, hashRetryDelay))
      }
    }
  }

  if (lastErr !== undefined) {
    console.log(
      ColorYellow + 'Warning: Could not verify file integrity: ' + (lastErr as Error).message + ColorReset
    )
    return
  }

  let data: Uint8Array
  try {
    const buf = await readFile(filePath)
    data = new Uint8Array(buf)
  } catch (err) {
    console.log(
      ColorYellow + 'Warning: Could not open local file for verification: ' + (err as Error).message + ColorReset
    )
    return
  }

  let localHash: string
  try {
    const hashBytes = QuickXorHash.sum(data)
    localHash = Buffer.from(hashBytes).toString('base64')
  } catch (err) {
    console.log(
      ColorYellow + 'Warning: Could not calculate file hash: ' + (err as Error).message + ColorReset
    )
    return
  }

  if (localHash === fileHash) {
    console.log(ColorGreen + 'File integrity verified successfully' + ColorReset)
  } else {
    console.log(ColorRed + 'Warning: File integrity check failed - hashes do not match' + ColorReset)
  }
}
