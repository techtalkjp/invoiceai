import { z } from 'zod'
import { parseOrThrow } from '../core/validation'

export const freeeAuthEnvSchema = z.object({
  FREEE_API_CLIENT_ID: z.string().min(1),
  FREEE_API_CLIENT_SECRET: z.string().min(1),
})

export const freeeAccessEnvSchema = z.object({
  FREEE_API_ACCESS_TOKEN: z.string().min(1),
})

export const freeeInvoiceEnvSchema = freeeAccessEnvSchema.extend({
  FREEE_COMPANY_ID: z.string().min(1),
  FREEE_TEMPLATE_ID: z.string().min(1),
})

export const googleAuthEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
})

export const googleAccessEnvSchema = z.object({
  GOOGLE_ACCESS_TOKEN: z.string().min(1),
})

export const googleRefreshEnvSchema = z.object({
  GOOGLE_REFRESH_TOKEN: z.string().min(1),
})

export function loadFreeeAuthEnv() {
  return parseOrThrow(
    freeeAuthEnvSchema,
    process.env,
    'FREEE_API_CLIENT_ID / FREEE_API_CLIENT_SECRET が .env に設定されていません',
    'ENV_INVALID',
  )
}

export function loadFreeeAccessEnv() {
  return parseOrThrow(
    freeeAccessEnvSchema,
    process.env,
    'FREEE_API_ACCESS_TOKEN が .env に設定されていません',
    'ENV_INVALID',
  )
}

export function loadFreeeInvoiceEnv() {
  return parseOrThrow(
    freeeInvoiceEnvSchema,
    process.env,
    'FREEE_API_ACCESS_TOKEN / FREEE_COMPANY_ID / FREEE_TEMPLATE_ID が .env に設定されていません',
    'ENV_INVALID',
  )
}

export function loadGoogleAuthEnv() {
  return parseOrThrow(
    googleAuthEnvSchema,
    process.env,
    'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が .env に設定されていません',
    'ENV_INVALID',
  )
}

export function loadGoogleAccessEnv() {
  return parseOrThrow(
    googleAccessEnvSchema,
    process.env,
    'GOOGLE_ACCESS_TOKEN が .env に設定されていません',
    'ENV_INVALID',
  )
}

export function loadGoogleRefreshEnv() {
  return parseOrThrow(
    googleRefreshEnvSchema,
    process.env,
    'GOOGLE_REFRESH_TOKEN が .env に設定されていません',
    'ENV_INVALID',
  )
}
