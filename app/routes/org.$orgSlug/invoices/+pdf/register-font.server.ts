import { Font } from '@react-pdf/renderer'
import fs from 'node:fs'
import path from 'node:path'

let registered = false

/**
 * サーバー側でPDFフォントを登録する。
 * ローカルフォントファイルをbase64エンコードして読み込む。
 * 二重登録を防ぐため、一度だけ実行される。
 */
export function registerPdfFontServer() {
  if (registered) return
  const fontPath = path.join(
    process.cwd(),
    'app/assets/fonts/NotoSansJP-Regular.ttf',
  )
  const fontBuffer = fs.readFileSync(fontPath)
  Font.register({
    family: 'NotoSansJP',
    src: `data:font/truetype;base64,${fontBuffer.toString('base64')}`,
  })
  registered = true
}
