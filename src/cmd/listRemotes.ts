import { type Command } from 'commander'
import { getConfigData } from './utils.ts'
import { parseRcloneConfigData, getAvailableRemotes } from '../azure/config.ts'

export function registerListRemotesCommand(program: Command): void {
  program
    .command('list-remotes')
    .description('List available remotes from the configuration file.')
    .action(async () => {
      console.log('reading configuration file...')

      let configData: Uint8Array
      try {
        configData = await getConfigData()
      } catch (err) {
        console.log('failed to get configuration file data:', (err as Error).message)
        process.exit(1)
      }

      let parsedConfig: Map<string, string>[]
      try {
        parsedConfig = parseRcloneConfigData(configData)
      } catch (err) {
        console.log('failed to parse configuration file data:', (err as Error).message)
        process.exit(1)
      }

      const availableRemotes = getAvailableRemotes(parsedConfig)
      console.log('available remotes: [' + availableRemotes.join(' ') + ']')
    })
}
