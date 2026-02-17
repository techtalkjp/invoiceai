import { describe, expect, it } from 'vitest'
import { normalizeRemoteUrl, parseGitLog } from './cli-git'

describe('normalizeRemoteUrl', () => {
  it('SSH URL を正規化する', () => {
    expect(normalizeRemoteUrl('git@github.com:owner/repo.git')).toBe(
      'github.com/owner/repo',
    )
  })

  it('SSH URL (.git なし) を正規化する', () => {
    expect(normalizeRemoteUrl('git@github.com:owner/repo')).toBe(
      'github.com/owner/repo',
    )
  })

  it('HTTPS URL を正規化する', () => {
    expect(normalizeRemoteUrl('https://github.com/owner/repo.git')).toBe(
      'github.com/owner/repo',
    )
  })

  it('HTTPS URL (.git なし) を正規化する', () => {
    expect(normalizeRemoteUrl('https://github.com/owner/repo')).toBe(
      'github.com/owner/repo',
    )
  })

  it('空文字は空文字を返す', () => {
    expect(normalizeRemoteUrl('')).toBe('')
  })
})

describe('parseGitLog', () => {
  it('numstat 付き git log をパースする', () => {
    const output = [
      'abc1234567890abcdef1234567890abcdef123456',
      '2025-06-01T10:00:00+09:00',
      'feat: add feature',
      '',
      '10\t2\tsrc/foo.ts',
      '5\t0\tsrc/bar.ts',
      'def7890123456789abcdef0123456789abcdef01',
      '2025-06-02T11:00:00+09:00',
      'fix: bug fix',
      '',
      '1\t3\tsrc/baz.ts',
    ].join('\n')

    const commits = parseGitLog(output)
    expect(commits).toHaveLength(2)
    expect(commits[0]).toEqual({
      hash: 'abc1234567890abcdef1234567890abcdef123456',
      date: '2025-06-01T10:00:00+09:00',
      message: 'feat: add feature',
      filesChanged: 2,
      additions: 15,
      deletions: 2,
    })
    expect(commits[1]).toEqual({
      hash: 'def7890123456789abcdef0123456789abcdef01',
      date: '2025-06-02T11:00:00+09:00',
      message: 'fix: bug fix',
      filesChanged: 1,
      additions: 1,
      deletions: 3,
    })
  })

  it('空の出力は空配列を返す', () => {
    expect(parseGitLog('')).toEqual([])
  })

  it('バイナリファイル（- - 表記）を扱える', () => {
    const output = [
      'abc1234567890abcdef1234567890abcdef123456',
      '2025-06-01T10:00:00+09:00',
      'add image',
      '',
      '-\t-\timage.png',
      '5\t0\tsrc/foo.ts',
    ].join('\n')

    const commits = parseGitLog(output)
    expect(commits[0]?.filesChanged).toBe(2)
    expect(commits[0]?.additions).toBe(5)
    expect(commits[0]?.deletions).toBe(0)
  })
})
