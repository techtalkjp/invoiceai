import { z } from 'zod'
import { parseOrThrow } from '~/lib/validation'

export const freeeAuthEnvSchema = z.object({
  FREEE_API_CLIENT_ID: z.string().min(1),
  FREEE_API_CLIENT_SECRET: z.string().min(1),
})

export function loadFreeeAuthEnv() {
  return parseOrThrow(
    freeeAuthEnvSchema,
    process.env,
    'FREEE_API_CLIENT_ID / FREEE_API_CLIENT_SECRET が .env に設定されていません',
    'ENV_INVALID',
  )
}
