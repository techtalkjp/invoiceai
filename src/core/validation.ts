import type { ZodSchema } from 'zod'
import { AppError } from './errors'

export function parseOrThrow<T>(
  schema: ZodSchema<T>,
  input: unknown,
  userMessage: string,
  code = 'VALIDATION_ERROR',
): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new AppError(code, result.error.message, userMessage)
  }
  return result.data
}
