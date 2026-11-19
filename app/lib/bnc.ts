import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { openSecret, sealSecret } from './bankSecrets'

// Server only. BNC's ESolutions API (Banco Nacional de Crédito), as its
// public docs describe it (documenter.getpostman.com/view/37111270/2sAYBRFtg4):
//
// - every call is a POST of { ClientGUID, Reference, Value, Validation,
//   swTestOperation }, where Value is the real request as JSON, encrypted
//   with AES, and Validation is that same JSON's SHA-256;
// - the key comes from PBKDF2-SHA1 (1000 rounds, salt "Ivan Medvedev") over
//   the store's MasterKey for the Logon, and over the day's WorkingKey (what
//   Logon returns) for everything else — 32 bytes of key, 16 of IV, AES-CBC
//   over the text as UTF-16LE (the .NET way);
// - the WorkingKey dies at midnight, or earlier when the bank answers RWK
//   ("Refresh Working Key"), so it's cached per day and re-fetched once on RWK.

const SALT = Buffer.from('Ivan Medvedev', 'ascii')

function derive(secret: string) {
  const b = pbkdf2Sync(Buffer.from(secret, 'utf8'), SALT, 1000, 48, 'sha1')
  return { key: b.subarray(0, 32), iv: b.subarray(32, 48) }
}

export function bncEncrypt(text: string, secret: string): string {
  const { key, iv } = derive(secret)
  const c = createCipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([c.update(Buffer.from(text, 'utf16le')), c.final()]).toString('base64')
}

export function bncDecrypt(b64: string, secret: string): string {
  const { key, iv } = derive(secret)
  const d = createDecipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([d.update(Buffer.from(b64, 'base64')), d.final()]).toString('utf16le')
}

export function bncHash(text: string): string {
  return createHash('sha256').update(text.trim(), 'utf8').digest('hex')
}

// Only the quality (test) server is published. A production URL, if BNC
// gives a different one, goes in BNC_PRODUCTION_URL.
const QA_URL = process.env.BNC_SANDBOX_URL || 'https://servicios.bncenlinea.com:16500/api'
function baseUrl(environment: string) {
  return environment === 'production' ? (process.env.BNC_PRODUCTION_URL || QA_URL).replace(/\/$/, '') : QA_URL
}

export type BncCreds = {
  storeId: string
  environment: string
  clientGuid: string
  masterKey: string
  childClientId: string | null
  branchId: string | null
  /** the store's RIF (ClientID), for SIMF/StatusOperation */
  merchantRif: string | null
  workingKey: string | null
  workingKeyDay: string | null
}

export class BncError extends Error {
  constructor(message: string, public code: string = '') { super(message) }
}

export async function loadBncCreds(supa: SupabaseClient, storeId: string): Promise<BncCreds | null> {
  const { data } = await supa.from('store_bank_credentials')
    .select('environment, client_id, api_key_enc, child_client_id, branch_id, merchant_rif, working_key_enc, working_key_day')
    .eq('store_id', storeId).eq('provider', 'bnc').maybeSingle()
  if (!data || !data.client_id || !data.api_key_enc) return null
  let workingKey: string | null = null
  try { workingKey = data.working_key_enc ? openSecret(data.working_key_enc) : null } catch { workingKey = null }
  return {
    storeId,
    environment: data.environment,
    clientGuid: data.client_id,
    masterKey: openSecret(data.api_key_enc),
    childClientId: data.child_client_id || null,
    branchId: data.branch_id || null,
    merchantRif: data.merchant_rif || null,
    workingKey,
    workingKeyDay: data.working_key_day || null,
  }
}

// Venezuela's calendar day — the WorkingKey expires at its midnight
const caracasDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })

// A Reference unique within the day, as the bank requires for each call
export function bncReference(prefix = 'LY') {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

type Envelope = {
  status?: string; message?: string; value?: string; validation?: string
  /** HTTP status, and the body as it came when it isn't the documented envelope */
  http?: number; body?: string
}

async function post(environment: string, path: string, body: unknown, timeoutMs: number): Promise<Envelope> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${baseUrl(environment)}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: 'no-store',
    })
    const text = (await r.text()).trim()
    let parsed: unknown = undefined
    try { parsed = JSON.parse(text) } catch { /* not JSON: see below */ }
    if (parsed && typeof parsed === 'object') {
      const env = parsed as Envelope
      // the documented shape has "status"; anything else (an ASP.NET error
      // like {"Message": "..."}, an empty object) is kept whole to read later
      return 'status' in env ? { ...env, http: r.status } : { http: r.status, body: text.slice(0, 1000) }
    }
    // A refusal comes as bare text with HTTP 409, e.g. "EPICNFNo es posible
    // encontrar al cliente…": the same 6-character code + message as a KO
    if (/^[A-Z0-9]{6}/.test(text)) return { status: 'KO', message: text.slice(0, 300), http: r.status }
    if (!text) return { http: r.status, body: '(vacío)' }
    throw new BncError(`El banco respondió algo inesperado (HTTP ${r.status})`, 'HTTP')
  } catch (e) {
    if (e instanceof BncError) throw e
    throw new BncError((e as Error).name === 'AbortError' ? 'El banco tardó demasiado en responder' : 'No se pudo conectar con el banco', 'NET')
  } finally { clearTimeout(t) }
}

function envelope(creds: BncCreds, payload: Record<string, unknown>, secret: string, reference: string) {
  const json = JSON.stringify(payload)
  return {
    ClientGUID: creds.clientGuid,
    Reference: reference,
    Value: bncEncrypt(json, secret),
    Validation: bncHash(json),
    swTestOperation: false,
  }
}

// A message is usually a 6-character code + text ("000000Consulta exitosa",
// "EPICNFNo es posible…"), but not always ("Se envió una solicitud de token
// al cliente.") — only take a code when there is one.
function splitMessage(m?: string) {
  const t = (m ?? '').trim()
  return /^[A-Z0-9]{6}/.test(t) ? { code: t.slice(0, 6), text: t.slice(6).trim() } : { code: '', text: t }
}
const messageCode = (m?: string) => splitMessage(m).code
const isRwk = (env: Envelope) => /RWK/.test(messageCode(env.message))

// A field of the bank's decrypted answer, whatever its casing ("Status" /
// "status"), as upper-case text ('' when missing)
export function bncField(value: Record<string, unknown> | null, name: string): string {
  if (!value) return ''
  const key = Object.keys(value).find(k => k.toLowerCase() === name.toLowerCase())
  const v = key ? value[key] : undefined
  return v === undefined || v === null ? '' : String(v).trim()
}

function openValue(env: Envelope, secret: string): Record<string, unknown> | null {
  if (!env.value) return null
  try { return JSON.parse(bncDecrypt(env.value, secret)) as Record<string, unknown> } catch { return null }
}

// Logon with the MasterKey; saves the day's WorkingKey (sealed) for reuse
export async function bncLogon(supa: SupabaseClient, creds: BncCreds): Promise<string> {
  const env = await post(creds.environment, '/Auth/LogOn',
    envelope(creds, { ClientGUID: creds.clientGuid }, creds.masterKey, bncReference('LG')), 30000)
  const value = openValue(env, creds.masterKey)
  const wk = typeof value?.WorkingKey === 'string' ? value.WorkingKey : null
  if (env.status !== 'OK' || !wk) {
    const { code, text } = splitMessage(env.message)
    throw new BncError(text || 'El banco no aceptó las credenciales', code)
  }
  creds.workingKey = wk
  creds.workingKeyDay = caracasDay()
  await supa.from('store_bank_credentials')
    .update({ working_key_enc: sealSecret(wk), working_key_day: creds.workingKeyDay })
    .eq('store_id', creds.storeId).eq('provider', 'bnc')
  return wk
}

export type BncResult = {
  ok: boolean; message: string; code: string; value: Record<string, unknown> | null
  /** what came back, for the record (no secrets in it) */
  raw: { status: string | null; message: string | null; value: Record<string, unknown> | null; http: number | null; body?: string }
}

// One call with the day's WorkingKey (logging on first when there's none for
// today, and once more if the bank asks for a fresh one).
export async function bncCall(
  supa: SupabaseClient, creds: BncCreds, path: string, payload: Record<string, unknown>,
  opts: { reference?: string; timeoutMs?: number } = {},
): Promise<BncResult> {
  const reference = opts.reference ?? bncReference()
  for (let attempt = 0; attempt < 2; attempt++) {
    const wk = creds.workingKey && creds.workingKeyDay === caracasDay() && attempt === 0
      ? creds.workingKey
      : await bncLogon(supa, creds)
    const env = await post(creds.environment, path, envelope(creds, payload, wk, reference), opts.timeoutMs ?? 60000)
    if (isRwk(env) && attempt === 0) { creds.workingKey = null; continue }
    const { code, text: msgText } = splitMessage(env.message)
    const text = msgText || (env.body ? `respuesta inesperada (HTTP ${env.http ?? '?'})` : '')
    const value = openValue(env, wk)
    return {
      ok: (env.status ?? '').toUpperCase() === 'OK',
      message: text,
      code,
      value,
      raw: { status: env.status ?? null, message: env.message ?? null, value, http: env.http ?? null, ...(env.body ? { body: env.body } : {}) },
    }
  }
  throw new BncError('El banco pidió renovar la llave de trabajo dos veces seguidas', 'RWK')
}

// What a customer sees when the bank says no (ISO codes from BNC's docs)
const REJECTS: Record<string, string> = {
  AB01: 'El banco tardó demasiado en responder. Intenta de nuevo.',
  AB07: 'Tu banco no está disponible en este momento. Intenta en unos minutos.',
  AC01: 'El número de cuenta o teléfono no es válido.',
  AC04: 'Esa cuenta está cancelada.',
  AC06: 'Esa cuenta está bloqueada.',
  AG09: 'El pago no llegó al banco. Intenta de nuevo.',
  AG10: 'Tu banco no está operando Débito inmediato ahora.',
  AM02: 'El monto no está permitido para Débito inmediato.',
  AM04: 'Saldo insuficiente.',
  AM05: 'Esta operación ya se había hecho.',
  BE01: 'La cédula no coincide con la cuenta o teléfono.',
  BE20: 'El nombre es demasiado largo.',
  CUST: 'El pago fue cancelado desde tu banco.',
  RC08: 'Ese banco no participa en Débito inmediato.',
  TKCM: 'El código no es correcto o ya venció. Pide uno nuevo.',
  VE01: 'El banco rechazó la operación por un error técnico. Intenta de nuevo.',
  DU01: 'Esta operación ya se había hecho.',
}
export function rejectMessage(code: string, fallback?: string) {
  return REJECTS[code] ?? (fallback ? `El banco no aprobó el pago: ${fallback}` : 'El banco no aprobó el pago.')
}
