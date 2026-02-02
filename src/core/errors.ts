export class AppError extends Error {
  code: string
  userMessage: string | undefined

  constructor(code: string, message: string, userMessage?: string) {
    super(message)
    this.code = code
    this.userMessage = userMessage
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
