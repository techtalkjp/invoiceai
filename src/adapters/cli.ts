import { exec } from 'node:child_process'

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
