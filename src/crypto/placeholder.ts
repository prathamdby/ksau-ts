import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const embeddedPrivkey = (Bun.embeddedFiles as unknown as Record<string, { text(): Promise<string> } | undefined>)['privkey.pem']
const embeddedPassphrase = (Bun.embeddedFiles as unknown as Record<string, { text(): Promise<string> } | undefined>)['passphrase.txt']

export const privkey: string = embeddedPrivkey
  ? await embeddedPrivkey.text()
  : readFileSync(join(import.meta.dir, 'privkey.pem'), 'utf8')

export const passphrase: string = (
  embeddedPassphrase
    ? await embeddedPassphrase.text()
    : readFileSync(join(import.meta.dir, 'passphrase.txt'), 'utf8')
).trimEnd()
