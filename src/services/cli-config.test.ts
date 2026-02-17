import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock homedir to use temp directory
const testDir = join(tmpdir(), `invoiceai-test-${Date.now()}`)
vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os')
  return { ...actual, homedir: () => testDir }
})

import {
  deleteConfig,
  getRepoConfig,
  loadConfig,
  saveAuth,
  saveConfig,
  saveRepoConfig,
  updateSyncState,
  type CliConfig,
  type RepoConfig,
} from './cli-config'

describe('cli-config', () => {
  beforeEach(() => {
    mkdirSync(join(testDir, '.config', 'invoiceai'), { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  const configPath = () => join(testDir, '.config', 'invoiceai', 'config.json')

  describe('loadConfig', () => {
    it('config がなければ null を返す', () => {
      expect(loadConfig()).toBeNull()
    })

    it('有効な config を読み込む', () => {
      const config: CliConfig = {
        auth: { serverUrl: 'https://example.com', token: 'tok' },
        repos: {},
      }
      writeFileSync(configPath(), JSON.stringify(config))
      expect(loadConfig()).toEqual(config)
    })

    it('不正な JSON なら null を返す', () => {
      writeFileSync(configPath(), 'invalid json')
      expect(loadConfig()).toBeNull()
    })
  })

  describe('saveConfig', () => {
    it('config を保存・読み込みできる', () => {
      const config: CliConfig = {
        auth: { serverUrl: 'https://example.com', token: 'tok' },
        repos: {
          '/home/user/repo': {
            orgSlug: 'my-org',
            clientId: 'client-1',
            remoteUrl: 'github.com/user/repo',
            lastSyncCommit: null,
            lastSyncedAt: null,
          },
        },
      }
      saveConfig(config)
      expect(loadConfig()).toEqual(config)
    })
  })

  describe('saveAuth', () => {
    it('新規の場合 auth のみ保存し repos は空', () => {
      saveAuth('tok', 'https://example.com')
      const config = loadConfig()
      expect(config).toEqual({
        auth: { token: 'tok', serverUrl: 'https://example.com' },
        repos: {},
      })
    })

    it('既存 repos を保持したまま auth を更新する', () => {
      const repo: RepoConfig = {
        orgSlug: 'org',
        clientId: 'c1',
        remoteUrl: 'github.com/u/r',
        lastSyncCommit: 'abc',
        lastSyncedAt: '2025-01-01',
      }
      saveConfig({
        auth: { token: 'old', serverUrl: 'https://old.com' },
        repos: { '/repo': repo },
      })
      saveAuth('new-tok', 'https://new.com')
      const config = loadConfig()
      expect(config?.auth).toEqual({
        token: 'new-tok',
        serverUrl: 'https://new.com',
      })
      expect(config?.repos['/repo']).toEqual(repo)
    })
  })

  describe('getRepoConfig', () => {
    it('設定がなければ null', () => {
      expect(getRepoConfig('/nonexistent')).toBeNull()
    })

    it('保存済みのリポジトリ設定を返す', () => {
      const repo: RepoConfig = {
        orgSlug: 'org',
        clientId: 'c1',
        remoteUrl: 'github.com/u/r',
        lastSyncCommit: null,
        lastSyncedAt: null,
      }
      saveConfig({
        auth: { token: 'tok', serverUrl: 'https://example.com' },
        repos: { '/my/repo': repo },
      })
      expect(getRepoConfig('/my/repo')).toEqual(repo)
    })
  })

  describe('saveRepoConfig', () => {
    it('ログインしていなければエラー', () => {
      expect(() =>
        saveRepoConfig('/repo', {
          orgSlug: 'org',
          clientId: 'c1',
          remoteUrl: 'github.com/u/r',
          lastSyncCommit: null,
          lastSyncedAt: null,
        }),
      ).toThrow('ログインしていません')
    })

    it('リポジトリ設定を追加保存できる', () => {
      saveAuth('tok', 'https://example.com')
      const repo: RepoConfig = {
        orgSlug: 'org',
        clientId: 'c1',
        remoteUrl: 'github.com/u/r',
        lastSyncCommit: null,
        lastSyncedAt: null,
      }
      saveRepoConfig('/repo', repo)
      expect(getRepoConfig('/repo')).toEqual(repo)
    })
  })

  describe('updateSyncState', () => {
    it('sync 後の状態を更新する', () => {
      saveAuth('tok', 'https://example.com')
      saveRepoConfig('/repo', {
        orgSlug: 'org',
        clientId: 'c1',
        remoteUrl: 'github.com/u/r',
        lastSyncCommit: null,
        lastSyncedAt: null,
      })
      updateSyncState('/repo', 'abc123', '2025-06-01T00:00:00Z')
      const repo = getRepoConfig('/repo')
      expect(repo?.lastSyncCommit).toBe('abc123')
      expect(repo?.lastSyncedAt).toBe('2025-06-01T00:00:00Z')
    })

    it('未設定リポジトリならエラー', () => {
      saveAuth('tok', 'https://example.com')
      expect(() => updateSyncState('/nonexistent', 'abc', 'now')).toThrow(
        'リポジトリ /nonexistent の設定が見つかりません',
      )
    })
  })

  describe('deleteConfig', () => {
    it('config を削除する', () => {
      saveAuth('tok', 'https://example.com')
      expect(deleteConfig()).toBe(true)
      expect(loadConfig()).toBeNull()
    })

    it('config がなければ false', () => {
      expect(deleteConfig()).toBe(false)
    })
  })
})
