import * as fs from 'node:fs'
import * as path from 'node:path'
import { AppError } from '../core/errors'

export function getEnvValue(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new AppError(
      'ENV_MISSING',
      `${key} is not set in .env`,
      `${key} が .env に設定されていません`,
    )
  }
  return value
}

// .envファイルを更新
export function updateEnvFile(updates: Record<string, string>) {
  const envPath = path.join(process.cwd(), '.env')
  updateEnvFileAt(envPath, updates)
}

export function updateEnvFileAt(
  envPath: string,
  updates: Record<string, string>,
) {
  let content = fs.readFileSync(envPath, 'utf-8')

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`)
    } else {
      content += `\n${key}=${value}`
    }
  }

  fs.writeFileSync(envPath, content)
  console.log('.env ファイルを更新しました')
}
