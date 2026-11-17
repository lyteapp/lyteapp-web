import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'crypto'

// Server only. Encrypts a store's bank API secrets before they're saved
// (AES-256-GCM). The key is BANK_CREDENTIALS_KEY (32 bytes, base64) when it's
// set; until then one derived from the Supabase service key, which only the
// server has. Each value says which key sealed it ("k" / "s"), so setting
// BANK_CREDENTIALS_KEY later doesn't lock out what was saved before.

function keyFor(kind: 'k' | 's'): Buffer {
  if (kind === 'k') {
    const raw = process.env.BANK_CREDENTIALS_KEY
    if (!raw) throw new Error('BANK_CREDENTIALS_KEY no está configurada')
    const k = Buffer.from(raw, 'base64')
    return k.length === 32 ? k : createHash('sha256').update(raw).digest()
  }
  const base = process.env.SUPABASE_SERVICE_KEY
  if (!base) throw new Error('Falta la clave de servicio')
  return Buffer.from(hkdfSync('sha256', base, 'lyte-bank-credentials', 'aes-256-gcm v1', 32))
}

export function sealSecret(plain: string): string {
  const kind = process.env.BANK_CREDENTIALS_KEY ? 'k' : 's'
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', keyFor(kind), iv)
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return ['v1', kind, iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join(':')
}

export function openSecret(sealed: string): string {
  const [v, kind, iv, tag, data] = sealed.split(':')
  if (v !== 'v1' || (kind !== 'k' && kind !== 's')) throw new Error('Formato desconocido')
  const d = createDecipheriv('aes-256-gcm', keyFor(kind), Buffer.from(iv, 'base64'))
  d.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8')
}
