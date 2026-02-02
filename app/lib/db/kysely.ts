import { CamelCasePlugin, Kysely, ParseJSONResultsPlugin } from 'kysely'
import { LibsqlDialect } from 'kysely-libsql'
import type { DB } from './types'

function getDialectConfig() {
  const isProduction = process.env.NODE_ENV === 'production'

  return isProduction
    ? {
        url: process.env.DATABASE_URL ?? '',
        authToken: process.env.DATABASE_AUTH_TOKEN ?? '',
      }
    : {
        url: 'file:db/local.db',
      }
}

// better-auth用（snake_caseカラム名をそのまま使用）
export const authDb = new Kysely<DB>({
  dialect: new LibsqlDialect(getDialectConfig()),
})

// アプリ用（CamelCasePluginでcamelCase変換）
export const db = new Kysely<DB>({
  dialect: new LibsqlDialect(getDialectConfig()),
  plugins: [new CamelCasePlugin(), new ParseJSONResultsPlugin()],
})
