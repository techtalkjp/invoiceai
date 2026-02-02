import { exec } from 'node:child_process'
import * as readline from 'node:readline'

// ブラウザを開く
export function openBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd =
      process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
          ? 'start'
          : 'xdg-open'
    exec(`${cmd} "${url}"`, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

// ユーザー入力を待つ
export function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}
