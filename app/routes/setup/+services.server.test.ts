import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const db = {
    updateTable: vi.fn(),
    insertInto: vi.fn(),
    selectFrom: vi.fn(),
  }

  return {
    db,
    markUserWorkspaceNameConfirmed: vi.fn(),
    markUserSetupCompleted: vi.fn(),
  }
})

vi.mock('~/lib/db/kysely', () => ({
  db: mocks.db,
}))

vi.mock('~/lib/auth-helpers.server', () => ({
  markUserWorkspaceNameConfirmed: mocks.markUserWorkspaceNameConfirmed,
  markUserSetupCompleted: mocks.markUserSetupCompleted,
}))

import {
  completeSetup,
  confirmWorkspaceName,
  findDuplicateClientName,
  upsertPrimaryClient,
} from './+services.server'

function createUpdateChain() {
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
    execute: vi.fn(),
  }

  chain.set.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.execute.mockResolvedValue(undefined)

  return chain
}

function createInsertChain() {
  const chain = {
    values: vi.fn(),
    execute: vi.fn(),
  }

  chain.values.mockReturnValue(chain)
  chain.execute.mockResolvedValue(undefined)

  return chain
}

function createSelectChain(result: unknown) {
  const chain = {
    select: vi.fn(),
    where: vi.fn(),
    executeTakeFirst: vi.fn(),
  }

  chain.select.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.executeTakeFirst.mockResolvedValue(result)

  return chain
}

describe('setup services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirmWorkspaceName updates organization and marks confirmation', async () => {
    const updateChain = createUpdateChain()
    mocks.db.updateTable.mockReturnValue(updateChain)

    await confirmWorkspaceName({
      organizationId: 'org-1',
      userId: 'user-1',
      workspaceName: '株式会社サンプル',
    })

    expect(mocks.db.updateTable).toHaveBeenCalledWith('organization')
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '株式会社サンプル',
      }),
    )
    expect(updateChain.where).toHaveBeenCalledWith('id', '=', 'org-1')
    expect(mocks.markUserWorkspaceNameConfirmed).toHaveBeenCalledWith(
      'org-1',
      'user-1',
    )
  })

  it('findDuplicateClientName adds exclusion condition when primary client exists', async () => {
    const selectChain = createSelectChain({ id: 'client-2' })
    mocks.db.selectFrom.mockReturnValue(selectChain)

    const duplicate = await findDuplicateClientName({
      organizationId: 'org-1',
      primaryClientId: 'client-1',
      name: '株式会社A',
    })

    expect(mocks.db.selectFrom).toHaveBeenCalledWith('client')
    expect(selectChain.where).toHaveBeenNthCalledWith(
      1,
      'organizationId',
      '=',
      'org-1',
    )
    expect(selectChain.where).toHaveBeenNthCalledWith(
      2,
      'name',
      '=',
      '株式会社A',
    )
    expect(selectChain.where).toHaveBeenNthCalledWith(3, 'id', '!=', 'client-1')
    expect(duplicate).toEqual({ id: 'client-2' })
  })

  it('upsertPrimaryClient updates existing primary client when id exists', async () => {
    const updateChain = createUpdateChain()
    mocks.db.updateTable.mockReturnValue(updateChain)

    await upsertPrimaryClient({
      organizationId: 'org-1',
      primaryClientId: 'client-1',
      value: {
        name: '株式会社A',
        billingType: 'time',
        hourlyRate: 10000,
        monthlyFee: undefined,
      },
    })

    expect(mocks.db.updateTable).toHaveBeenCalledWith('client')
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '株式会社A',
        billingType: 'time',
        hourlyRate: 10000,
        monthlyFee: null,
      }),
    )
    expect(updateChain.where).toHaveBeenCalledWith('id', '=', 'client-1')
    expect(mocks.db.insertInto).not.toHaveBeenCalled()
  })

  it('upsertPrimaryClient inserts a new client when primary client does not exist', async () => {
    const insertChain = createInsertChain()
    mocks.db.insertInto.mockReturnValue(insertChain)

    await upsertPrimaryClient({
      organizationId: 'org-1',
      primaryClientId: null,
      value: {
        name: '株式会社B',
        billingType: 'fixed',
        hourlyRate: undefined,
        monthlyFee: 300000,
      },
    })

    expect(mocks.db.insertInto).toHaveBeenCalledWith('client')
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        name: '株式会社B',
        billingType: 'fixed',
        hourlyRate: null,
        monthlyFee: 300000,
      }),
    )
    expect(mocks.db.updateTable).not.toHaveBeenCalled()
  })

  it('completeSetup delegates to markUserSetupCompleted', async () => {
    await completeSetup({
      organizationId: 'org-1',
      userId: 'user-1',
    })

    expect(mocks.markUserSetupCompleted).toHaveBeenCalledWith('org-1', 'user-1')
  })
})
