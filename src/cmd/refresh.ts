import { type Command } from 'commander'
import fs from 'node:fs'
import { getConfigPath } from './utils.ts'

const DEFAULT_URL =
  'https://raw.githubusercontent.com/global-index-source/creds/main/rclone.conf.asc'

export function registerRefreshCommand(program: Command): void {
  program
    .command('refresh')
    .description('Refresh rclone config file')
    .option('-u, --url <url>', 'Sets a custom url (must be direct.)')
    .action(async (opts) => {
      const targetUrl: string = opts.url || DEFAULT_URL

      console.log('fetching rclone config from', targetUrl)

      let resp: Response
      try {
        resp = await fetch(targetUrl)
      } catch (err) {
        console.log('failed to fetch config file:', (err as Error).message)
        process.exit(1)
      }

      let body: Uint8Array
      try {
        body = new Uint8Array(await resp.arrayBuffer())
      } catch (err) {
        console.log('something is wrong with the response:', (err as Error).message)
        process.exit(1)
      }

      const userConfigFilePath = getConfigPath()
      console.log('writing config file to', userConfigFilePath)
      fs.writeFileSync(userConfigFilePath, body)
    })
}
