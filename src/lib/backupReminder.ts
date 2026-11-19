const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function shouldShowBackupReminder(
  lastBackupAt: unknown,
  now: Date = new Date(),
): boolean {
  if (typeof lastBackupAt !== 'string' || lastBackupAt.trim() === '') return true

  const timestamp = Date.parse(lastBackupAt)
  const currentTime = now.getTime()
  if (!Number.isFinite(timestamp) || !Number.isFinite(currentTime) || timestamp > currentTime) return true

  return currentTime - timestamp > THIRTY_DAYS_MS
}
