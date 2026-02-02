import { cac } from 'cac'
import 'dotenv/config'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { openBrowser, prompt } from './adapters/cli'
import { getEnvValue, updateEnvFile } from './adapters/env'
import { runCli } from './cli/run'
import { AppError } from './core/errors'
import { parseOrThrow } from './core/validation'
import {
  buildFreeeAuthUrl,
  refreshFreeeToken,
  requestFreeeTokenWithCode,
} from './services/freee-oauth'
import { loadFreeeAuthEnv } from './validators/env'

const TOKEN_URL = 'https://accounts.secure.freee.co.jp/public_api/token'
const AUTH_URL = 'https://accounts.secure.freee.co.jp/public_api/authorize'
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'

// 認可URLを生成
function getAuthUrl(): string {
  const clientId = getEnvValue('FREEE_API_CLIENT_ID')
  return buildFreeeAuthUrl(AUTH_URL, clientId, REDIRECT_URI)
}

// 認可コードからトークンを取得
function getTokenFromCode(code: string) {
  return requestFreeeTokenWithCode(
    {
      tokenUrl: TOKEN_URL,
      clientId: getEnvValue('FREEE_API_CLIENT_ID'),
      clientSecret: getEnvValue('FREEE_API_CLIENT_SECRET'),
      redirectUri: REDIRECT_URI,
    },
    code,
  )
}

// リフレッシュトークンでアクセストークンを更新
function refreshToken() {
  const refreshToken = getEnvValue('FREEE_API_REFRESH_TOKEN')
  return refreshFreeeToken(
    {
      tokenUrl: TOKEN_URL,
      clientId: getEnvValue('FREEE_API_CLIENT_ID'),
      clientSecret: getEnvValue('FREEE_API_CLIENT_SECRET'),
      redirectUri: REDIRECT_URI,
    },
    refreshToken,
  )
}

function main() {
  const cli = cac('auth')
  const _command = process.argv[2]
  loadFreeeAuthEnv()

  const commandsSchema = z.discriminatedUnion('command', [
    z.object({ command: z.literal('login') }),
    z.object({ command: z.literal('url') }),
    z.object({ command: z.literal('refresh') }),
    z.object({ command: z.literal('token'), code: z.string().min(1) }),
  ])

  const runCommand = async (input: z.infer<typeof commandsSchema>) =>
    match(input)
      .with({ command: 'login' }, async () => {
        // ブラウザを開いて認可フローを実行
        const authUrl = getAuthUrl()
        console.log('ブラウザで認可ページを開いています...\n')
        await openBrowser(authUrl)

        console.log('freeeにログインして「許可する」をクリックしてください。')
        console.log('表示された認可コードをコピーしてください。\n')

        const code = await prompt('認可コード: ')
        if (!code) {
          throw new AppError(
            'AUTH_CODE_MISSING',
            'Authorization code is missing',
            '認可コードが入力されませんでした',
          )
        }

        console.log('\nトークンを取得中...')
        const data = await getTokenFromCode(code)

        // .envを更新
        updateEnvFile({
          FREEE_API_ACCESS_TOKEN: data.access_token,
          FREEE_API_REFRESH_TOKEN: data.refresh_token,
        })

        console.log('\n認証完了! 以下のコマンドで請求書を確認できます:')
        console.log('  pnpm freee companies')
      })
      .with({ command: 'url' }, () => {
        // 認可URLを表示（手動用）
        console.log('認可URL:\n')
        console.log(getAuthUrl())
      })
      .with({ command: 'token' }, async (input) => {
        // 認可コードからトークン取得（手動用）
        console.log('トークンを取得中...')
        const data = await getTokenFromCode(input.code)

        updateEnvFile({
          FREEE_API_ACCESS_TOKEN: data.access_token,
          FREEE_API_REFRESH_TOKEN: data.refresh_token,
        })

        console.log('認証完了!')
      })
      .with({ command: 'refresh' }, async () => {
        // トークンリフレッシュ
        console.log('トークンを更新中...')
        const data = await refreshToken()

        console.log('\n=== 更新したトークン ===')
        console.log(`Access Token: ${data.access_token}`)
        console.log(`Refresh Token: ${data.refresh_token}`)
        console.log(`Expires In: ${data.expires_in}秒`)

        // .envを更新
        updateEnvFile({
          FREEE_API_ACCESS_TOKEN: data.access_token,
          FREEE_API_REFRESH_TOKEN: data.refresh_token,
        })
      })
      .otherwise(() => {
        console.log(`freee OAuth認証

Usage:
  pnpm auth <command>

Commands:
  login          ブラウザを開いて認証（推奨）
  refresh        トークンを更新（期限切れ時）
  url            認可URLを表示（手動用）
  token <code>   認可コードからトークン取得（手動用）
`)
      })

  cli
    .command('login', 'ブラウザを開いて認証')
    .action(async () => runCommand({ command: 'login' }))
  cli
    .command('url', '認可URLを表示')
    .action(async () => runCommand({ command: 'url' }))
  cli
    .command('refresh', 'トークンを更新')
    .action(async () => runCommand({ command: 'refresh' }))
  cli
    .command('token <code>', '認可コードからトークン取得')
    .action(async (code) =>
      runCommand(
        parseOrThrow(
          commandsSchema,
          { command: 'token', code },
          'Usage: pnpm auth token <認可コード>',
          'ARGS_INVALID',
        ),
      ),
    )
  cli.command('', 'ヘルプを表示').action(async () => cli.outputHelp())

  cli.parse()
}

runCli(main)
