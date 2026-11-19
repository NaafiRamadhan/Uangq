import { describe, expect, it } from 'vitest'
import { shouldShowBackupReminder } from './backupReminder'

const now = new Date('2026-11-19T00:00:00.000Z')
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

describe('shouldShowBackupReminder', () => {
  it('reminds when no backup has ever been recorded', () => {
    expect(shouldShowBackupReminder(undefined, now)).toBe(true)
    expect(shouldShowBackupReminder(null, now)).toBe(true)
  })

  it('does not remind at or before the 30-day threshold', () => {
    expect(shouldShowBackupReminder(new Date(now.getTime() - thirtyDaysMs).toISOString(), now)).toBe(false)
    expect(shouldShowBackupReminder(new Date(now.getTime() - thirtyDaysMs + 1).toISOString(), now)).toBe(false)
  })

  it('reminds when the last backup is more than 30 days old', () => {
    expect(shouldShowBackupReminder(new Date(now.getTime() - thirtyDaysMs - 1).toISOString(), now)).toBe(true)
  })

  it('reminds when the stored timestamp is invalid or in the future', () => {
    expect(shouldShowBackupReminder('not-a-date', now)).toBe(true)
    expect(shouldShowBackupReminder(new Date(now.getTime() + 1).toISOString(), now)).toBe(true)
  })
})
