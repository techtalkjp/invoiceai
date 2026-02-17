import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { openBrowser } from '../adapters/cli'
import { saveAuth } from './cli-config'

const DEFAULT_PORT = 8791
const DEFAULT_SERVER_URL =
  process.env.INVOICEAI_SERVER_URL ?? 'https://www.invoiceai.dev'

/**
 * CLI ログインフロー:
 * 1. ローカルにHTTPサーバーを立てる（state パラメータで token injection を防止）
 * 2. ブラウザで /auth/cli-callback?port=PORT&state=STATE を開く
 * 3. ブラウザ側でログイン → セッショントークン + state をローカルサーバーに POST
 * 4. state を検証し、認証情報を credentials.json に保存
 */
export async function cliLogin(
  serverUrl: string = DEFAULT_SERVER_URL,
): Promise<void> {
  const port = DEFAULT_PORT
  const state = randomBytes(32).toString('hex')

  const token = await new Promise<string>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>

    const server = createServer((req, res) => {
      // CORS: サーバーURLのオリジンのみ許可
      const allowedOrigin = new URL(serverUrl).origin
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      if (req.method === 'POST' && req.url === '/callback') {
        let body = ''
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as {
              token?: string
              state?: string
            }
            if (data.state !== state) {
              res.writeHead(403, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'invalid state' }))
              return
            }
            if (data.token) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: true }))
              clearTimeout(timeoutId)
              server.close()
              resolve(data.token)
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'token missing' }))
            }
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'invalid json' }))
          }
        })
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    server.on('error', (err) => {
      reject(new Error(`ローカルサーバーの起動に失敗しました: ${err.message}`))
    })

    server.listen(port, () => {
      const callbackUrl = `${serverUrl}/auth/cli-callback?port=${port}&state=${state}`
      console.log(`ブラウザでログインしてください...`)
      openBrowser(callbackUrl).catch(() => {
        console.log(`ブラウザが開けない場合は以下のURLを開いてください:`)
        console.log(callbackUrl)
      })
    })

    // 2分でタイムアウト
    timeoutId = setTimeout(() => {
      server.close()
      reject(new Error('ログインがタイムアウトしました（2分）'))
    }, 120_000)
  })

  saveAuth(token, serverUrl)
  console.log('ログインに成功しました')
}
