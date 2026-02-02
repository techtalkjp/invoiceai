import { z } from 'zod'

export function getBaseUrl(request: Request): string {
  const envUrl = process.env.WEB_BASE_URL
  if (envUrl) {
    const parsed = z.string().url().safeParse(envUrl)
    if (parsed.success) {
      return parsed.data
    }
  }
  return new URL(request.url).origin
}
