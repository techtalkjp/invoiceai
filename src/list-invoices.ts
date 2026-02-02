import { cac } from 'cac'
import 'dotenv/config'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { getEnvValue } from './adapters/env'
import { runCli } from './cli/run'
import { AppError } from './core/errors'
import { parseOrThrow } from './core/validation'
import { createFreeeClient } from './freee-client'
import {
  listCompanies,
  listInvoices,
  listPartners,
  listTemplates,
  showInvoice,
} from './services/freee-listing'
import { loadFreeeAccessEnv } from './validators/env'

function getCompanyId(arg?: string): number {
  const id = arg || process.env.FREEE_COMPANY_ID
  if (!id) {
    throw new AppError(
      'COMPANY_ID_MISSING',
      'company_id is missing',
      'company_id が指定されていません。引数で指定するか .env に FREEE_COMPANY_ID を設定してください。',
    )
  }
  return Number(id)
}

function main() {
  const cli = cac('freee')
  loadFreeeAccessEnv()
  const freee = createFreeeClient({
    getAccessToken: () => getEnvValue('FREEE_API_ACCESS_TOKEN'),
  })
  const deps = {
    getCompanies: freee.getCompanies,
    getInvoices: freee.getInvoices,
    getInvoice: freee.getInvoice,
    getInvoiceTemplates: freee.getInvoiceTemplates,
    getPartners: freee.getPartners,
  }

  const commandsSchema = z.discriminatedUnion('command', [
    z.object({ command: z.literal('companies') }),
    z.object({ command: z.literal('partners') }),
    z.object({ command: z.literal('templates') }),
    z.object({
      command: z.literal('list'),
      limit: z.number().int().positive().default(20),
    }),
    z.object({
      command: z.literal('show'),
      invoiceId: z.number().int().positive(),
    }),
  ])

  const runCommand = async (input: z.infer<typeof commandsSchema>) =>
    match(input)
      .with({ command: 'companies' }, async () => {
        // 事業所一覧
        const { companies } = await listCompanies(deps)
        console.log('=== 事業所一覧 ===\n')
        for (const c of companies) {
          console.log(`ID: ${c.id}`)
          console.log(`名前: ${c.name}`)
          console.log(`表示名: ${c.display_name}`)
          console.log(`権限: ${c.role}`)
          console.log('---')
        }
      })
      .with({ command: 'partners' }, async () => {
        // 取引先一覧
        const companyId = getCompanyId()
        const { partners } = await listPartners(deps, companyId)
        console.log('=== 取引先一覧 ===\n')
        for (const p of partners) {
          console.log(`ID: ${p.id} | ${p.name}${p.code ? ` (${p.code})` : ''}`)
        }
      })
      .with({ command: 'templates' }, async () => {
        // テンプレート一覧
        const companyId = getCompanyId()
        const { templates } = await listTemplates(deps, companyId)
        console.log('=== 請求書テンプレート一覧 ===\n')
        for (const t of templates) {
          console.log(`ID: ${t.id} | ${t.name}`)
        }
      })
      .with({ command: 'list' }, async (input) => {
        // 請求書一覧（新しい順）
        const companyId = getCompanyId()
        const { display, total } = await listInvoices(
          deps,
          companyId,
          input.limit,
        )
        console.log(`=== 請求書一覧 (${display.length}/${total}件) ===\n`)
        for (const inv of display) {
          console.log(`[${inv.invoice_number}] ${inv.billing_date}`)
          console.log(`  取引先: ${inv.partner_name}`)
          console.log(`  件名: ${inv.subject || '(なし)'}`)
          console.log(
            `  金額: ¥${inv.total_amount.toLocaleString()} | 送付: ${inv.sending_status} | 入金: ${inv.payment_status}`,
          )
          console.log(`  ID: ${inv.id}`)
          console.log('---')
        }
      })
      .with({ command: 'show' }, async (input) => {
        // 請求書詳細
        const companyId = getCompanyId()
        const { invoice } = await showInvoice(deps, companyId, input.invoiceId)
        console.log('=== 請求書詳細 ===\n')
        console.log(`請求書番号: ${invoice.invoice_number}`)
        console.log(`請求日: ${invoice.billing_date}`)
        console.log(`支払期日: ${invoice.payment_date || '(なし)'}`)
        console.log(
          `送付: ${invoice.sending_status} | 入金: ${invoice.payment_status}`,
        )
        console.log('')
        console.log(
          `宛先: ${invoice.partner_display_name} ${invoice.partner_title}`,
        )
        console.log(`件名: ${invoice.subject || '(なし)'}`)
        console.log(`備考: ${invoice.invoice_note || '(なし)'}`)
        console.log(`社内メモ: ${invoice.memo || '(なし)'}`)
        console.log('')
        console.log('--- 明細 ---')
        for (const line of invoice.lines) {
          if (line.type === 'text') {
            console.log(`  [テキスト] ${line.description}`)
          } else {
            console.log(
              `  ${line.description} | ${line.quantity} ${line.unit} × ¥${Number(line.unit_price).toLocaleString()} = ¥${line.amount_excluding_tax.toLocaleString()} (税率${line.tax_rate}%)`,
            )
          }
        }
        console.log('---')
        console.log(`小計: ¥${invoice.amount_excluding_tax.toLocaleString()}`)
        console.log(`消費税: ¥${invoice.amount_tax.toLocaleString()}`)
        console.log(`合計: ¥${invoice.total_amount.toLocaleString()}`)
      })
      .otherwise(() => {
        console.log(`freee請求書 CLI

Usage:
  pnpm freee <command> [args]

Commands:
  companies      事業所一覧を表示
  partners       取引先一覧を表示
  templates      請求書テンプレート一覧を表示
  list [limit]   請求書一覧を表示 (デフォルト20件)
  show <id>      請求書詳細を表示

※ FREEE_COMPANY_ID が .env に設定されている場合、company_id は省略可能
`)
      })

  cli
    .command('companies', '事業所一覧を表示')
    .action(() => runCommand({ command: 'companies' }))
  cli
    .command('partners', '取引先一覧を表示')
    .action(() => runCommand({ command: 'partners' }))
  cli
    .command('templates', '請求書テンプレート一覧を表示')
    .action(() => runCommand({ command: 'templates' }))
  cli
    .command('list [limit]', '請求書一覧を表示')
    .action((limit) =>
      runCommand(
        parseOrThrow(
          commandsSchema,
          { command: 'list', limit: limit ? Number(limit) : 20 },
          'Usage: pnpm freee list [limit]',
          'ARGS_INVALID',
        ),
      ),
    )
  cli
    .command('show <invoiceId>', '請求書詳細を表示')
    .action(async (invoiceId) =>
      runCommand(
        parseOrThrow(
          commandsSchema,
          { command: 'show', invoiceId: Number(invoiceId) },
          'Usage: pnpm freee show <invoice_id>',
          'ARGS_INVALID',
        ),
      ),
    )
  cli.command('', 'ヘルプを表示').action(() => {
    cli.outputHelp()
  })

  cli.parse()
}

runCli(main)
