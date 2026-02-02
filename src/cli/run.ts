import { isAppError } from '../core/errors'

export async function runCli(main: () => void) {
  try {
    await main()
  } catch (error) {
    if (isAppError(error)) {
      console.error(error.userMessage ?? error.message)
    } else {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Error:', message)
    }
    process.exitCode = 1
  }
}
