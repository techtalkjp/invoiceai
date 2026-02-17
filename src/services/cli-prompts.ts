import { createInterface } from 'node:readline'

function createRl() {
  return createInterface({ input: process.stdin, output: process.stdout })
}

export function askQuestion(question: string): Promise<string> {
  const rl = createRl()
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export async function askYesNo(question: string): Promise<boolean> {
  const answer = await askQuestion(`${question} (y/n): `)
  return answer.toLowerCase().startsWith('y')
}

export async function selectFromList<T extends { id: string; name: string }>(
  items: T[],
  label: string,
  prompt: string = '番号を入力',
): Promise<T> {
  if (items.length === 0) {
    throw new Error(`${label}が見つかりません。`)
  }

  const first = items[0]
  if (items.length === 1 && first) {
    console.log(`${label}: ${first.name}（自動選択）`)
    return first
  }

  console.log(`\n${label}を選択してください:`)
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item) {
      console.log(`  ${i + 1}. ${item.name}`)
    }
  }

  const answer = await askQuestion(`${prompt} (1-${items.length}): `)
  const index = Number.parseInt(answer, 10) - 1

  if (index < 0 || index >= items.length || Number.isNaN(index)) {
    throw new Error('無効な選択です。')
  }

  const selected = items[index]
  if (!selected) {
    throw new Error('無効な選択です。')
  }

  return selected
}

export async function askClientName(): Promise<string> {
  const name = await askQuestion('クライアント名を入力してください: ')
  if (!name) {
    throw new Error('クライアント名が空です。')
  }
  return name
}
