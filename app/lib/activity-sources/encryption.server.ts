import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  const buf = Buffer.from(key, 'base64')
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (base64 encoded)')
  }
  return buf
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  // Format: base64(iv + authTag + ciphertext)
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decrypt(encoded: string): string {
  const key = getEncryptionKey()
  const data = Buffer.from(encoded, 'base64')
  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Encrypted data is too short or corrupted')
  }
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
