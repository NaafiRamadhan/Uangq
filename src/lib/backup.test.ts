import { describe, expect, it } from 'vitest'
import { createBackup, validateBackup } from './backup'

const emptyData = {
  wallets: [],
  categories: [],
  transactions: [],
  budgets: [],
  budgetItems: [],
  settings: [],
}

describe('backup', () => {
  it('creates a version 1 Uangq backup', () => {
    const backup = createBackup(emptyData, '2026-01-01T00:00:00.000Z')

    expect(backup.app).toBe('Uangq')
    expect(backup.schemaVersion).toBe(1)
    expect(backup.exportedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('accepts a valid backup', () => {
    expect(validateBackup(createBackup(emptyData))).toBeTruthy()
  })

  it('rejects a newer backup schema', () => {
    expect(() =>
      validateBackup({ ...createBackup(emptyData), schemaVersion: 2 }),
    ).toThrow('lebih baru')
  })

  it('rejects a backup from another app', () => {
    expect(() => validateBackup({ ...createBackup(emptyData), app: 'Other' })).toThrow(
      'bukan milik Uangq',
    )
  })
})
