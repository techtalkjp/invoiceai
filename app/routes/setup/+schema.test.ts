import { describe, expect, it } from 'vitest'
import { clientSchema, workspaceSchema } from './+schema'

describe('setup schemas', () => {
  it('accepts valid workspace name', () => {
    const result = workspaceSchema.safeParse({
      workspaceName: '株式会社サンプル',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty workspace name', () => {
    const result = workspaceSchema.safeParse({
      workspaceName: '',
    })
    expect(result.success).toBe(false)
  })

  it('requires hourlyRate when billingType is time', () => {
    const result = clientSchema.safeParse({
      name: 'クライアントA',
      billingType: 'time',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid time billing payload', () => {
    const result = clientSchema.safeParse({
      name: 'クライアントA',
      billingType: 'time',
      hourlyRate: 10000,
    })
    expect(result.success).toBe(true)
  })

  it('requires monthlyFee when billingType is fixed', () => {
    const result = clientSchema.safeParse({
      name: 'クライアントB',
      billingType: 'fixed',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid fixed billing payload', () => {
    const result = clientSchema.safeParse({
      name: 'クライアントB',
      billingType: 'fixed',
      monthlyFee: 300000,
    })
    expect(result.success).toBe(true)
  })
})
