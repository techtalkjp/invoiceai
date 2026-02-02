import { cac } from 'cac'
import 'dotenv/config'
import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { openBrowser } from './adapters/cli'
import { getEnvValue, updateEnvFile } from './adapters/env'
import { runCli } from './cli/run'
import { AppError } from './core/errors'
import {
  buildGoogleAuthUrl,
  refreshGoogleAccessToken,
  requestGoogleTokenWithCode,
} from './services/google-oauth'
import { loadGoogleAuthEnv } from './validators/env'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const CALLBACK_PORT = 3000
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'].join(' ')

// 認可URLを生成
function getAuthUrl(): string {
  const clientId = getEnvValue('GOOGLE_CLIENT_ID')
  return buildGoogleAuthUrl(
    GOOGLE_AUTH_URL,
    clientId,
    REDIRECT_URI,
    SCOPES.split(' '),
  )
}

// ローカルサーバーで認可コードを受け取る
function waitForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '', `http://localhost:${CALLBACK_PORT}`)

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`
            <html><body>
              <h1>認証エラー</h1>
              <p>${error}</p>
              <p>このウィンドウを閉じてください。</p>
            </body></html>
          `)
          server.close()
          reject(
            new AppError(
              'GOOGLE_AUTH_ERROR',
              `Authorization error: ${error}`,
              `認証エラー: ${error}`,
            ),
          )
          return
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`
            <html><body>
              <h1>認証成功!</h1>
              <p>このウィンドウを閉じてください。</p>
              <script>window.close();</script>
            </body></html>
          `)
          server.close()
          resolve(code)
          return
        }
      }

      res.writeHead(404)
      res.end('Not Found')
    })

    server.listen(CALLBACK_PORT, () => {
      console.log(`コールバックサーバー起動: http://localhost:${CALLBACK_PORT}`)
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(
          new AppError(
            'PORT_IN_USE',
            `Port ${CALLBACK_PORT} is already in use`,
            `ポート ${CALLBACK_PORT} が使用中です。他のプロセスを停止してから再試行してください。`,
          ),
        )
      } else {
        reject(err)
      }
    })

    // タイムアウト設定（5分）
    setTimeout(
      () => {
        server.close()
        reject(
          new AppError(
            'AUTH_TIMEOUT',
            'Authorization timed out',
            '認証がタイムアウトしました',
          ),
        )
      },
      5 * 60 * 1000,
    )
  })
}

// 認可コードからトークンを取得
function getTokenFromCode(code: string) {
  return requestGoogleTokenWithCode(
    {
      tokenUrl: GOOGLE_TOKEN_URL,
      clientId: getEnvValue('GOOGLE_CLIENT_ID'),
      clientSecret: getEnvValue('GOOGLE_CLIENT_SECRET'),
      redirectUri: REDIRECT_URI,
    },
    code,
  )
}

// リフレッシュトークンでアクセストークンを更新
export async function refreshGoogleToken() {
  const refreshToken = getEnvValue('GOOGLE_REFRESH_TOKEN')
  const data = await refreshGoogleAccessToken(
    {
      tokenUrl: GOOGLE_TOKEN_URL,
      clientId: getEnvValue('GOOGLE_CLIENT_ID'),
      clientSecret: getEnvValue('GOOGLE_CLIENT_SECRET'),
      redirectUri: REDIRECT_URI,
    },
    refreshToken,
  )

  // アクセストークンを更新（リフレッシュトークンは通常変わらない）
  updateEnvFile({
    GOOGLE_ACCESS_TOKEN: data.access_token,
  })

  return data.access_token
}

// アクセストークンを取得（必要に応じてリフレッシュ）
// biome-ignore lint/suspicious/useAwait: returns Promise for GoogleDeps interface
export async function getGoogleAccessToken(): Promise<string> {
  const token = process.env.GOOGLE_ACCESS_TOKEN
  if (!token) {
    throw new AppError(
      'GOOGLE_TOKEN_MISSING',
      'GOOGLE_ACCESS_TOKEN is not set',
      'GOOGLE_ACCESS_TOKEN is not set. Run: pnpm google login',
    )
  }
  return token
}

function main() {
  const cli = cac('google')
  const _command = process.argv[2]
  loadGoogleAuthEnv()

  const commandsSchema = z.discriminatedUnion('command', [
    z.object({ command: z.literal('login') }),
    z.object({ command: z.literal('refresh') }),
  ])

  const runCommand = async (input: z.infer<typeof commandsSchema>) =>
    match(input)
      .with({ command: 'login' }, async () => {
        const authUrl = getAuthUrl()
        console.log('ブラウザでGoogle認可ページを開いています...\n')

        // コールバックサーバーを先に起動
        const codePromise = waitForAuthCode()

        // ブラウザを開く
        await openBrowser(authUrl)

        console.log(
          'Googleアカウントでログインし、アクセスを許可してください。\n',
        )

        // 認可コードを待つ
        const code = await codePromise

        console.log('\nトークンを取得中...')
        const data = await getTokenFromCode(code)

        updateEnvFile({
          GOOGLE_ACCESS_TOKEN: data.access_token,
          GOOGLE_REFRESH_TOKEN: data.refresh_token,
        })

        console.log('\nGoogle認証完了!')
      })
      .with({ command: 'refresh' }, async () => {
        console.log('トークンを更新中...')
        await refreshGoogleToken()
        console.log('Google トークン更新完了!')
      })
      .otherwise(() => {
        console.log(`Google OAuth認証

Usage:
  pnpm google <command>

Commands:
  login     ブラウザを開いて認証
  refresh   トークンを更新
`)
      })

  cli
    .command('login', 'ブラウザを開いて認証')
    .action(async () => runCommand({ command: 'login' }))
  cli
    .command('refresh', 'トークンを更新')
    .action(async () => runCommand({ command: 'refresh' }))
  cli.command('', 'ヘルプを表示').action(async () => cli.outputHelp())

  cli.parse()
}

// CLIとして実行された場合のみmain()を実行
const argvEntry = process.argv[1]
if (argvEntry) {
  const entryPath = path.resolve(argvEntry)
  const selfPath = path.resolve(fileURLToPath(import.meta.url))
  if (entryPath === selfPath || argvEntry.includes('google-auth')) {
    runCli(main)
  }
}
