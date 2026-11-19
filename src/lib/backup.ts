import type { Budget, BudgetItem, Category, Setting, Transaction, Wallet } from '../db/schema'
import { db } from '../db/schema'
import { LAST_BACKUP_SETTING_KEY } from './settings'
import { downloadBlob } from './download'

export const BACKUP_SCHEMA_VERSION = 1

export type BackupData = {
  wallets: Wallet[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  budgetItems: BudgetItem[]
  settings: Setting[]
}

export type BackupFile = {
  app: 'Uangq'
  schemaVersion: number
  exportedAt: string
  data: BackupData
}

export function createBackup(
  data: BackupData,
  exportedAt = new Date().toISOString(),
): BackupFile {
  return {
    app: 'Uangq',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    data,
  }
}

export function validateBackup(value: unknown): BackupFile {
  if (!value || typeof value !== 'object') throw new Error('File backup tidak valid.')

  const backup = value as Partial<BackupFile>
  if (backup.app !== 'Uangq') throw new Error('File bukan milik Uangq.')
  if (typeof backup.schemaVersion !== 'number') throw new Error('Versi schema tidak valid.')
  if (backup.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error('Versi backup lebih baru daripada versi aplikasi.')
  }
  if (!backup.data || typeof backup.data !== 'object') throw new Error('Data backup tidak ditemukan.')

  for (const table of ['wallets', 'categories', 'transactions', 'budgets', 'budgetItems', 'settings']) {
    if (!Array.isArray((backup.data as Record<string, unknown>)[table])) {
      throw new Error(`Data ${table} tidak valid.`)
    }
  }

  return backup as BackupFile
}

export async function readBackupData(): Promise<BackupData> {
  return {
    wallets: await db.wallets.toArray(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    budgets: await db.budgets.toArray(),
    budgetItems: await db.budgetItems.toArray(),
    settings: await db.settings.toArray(),
  }
}

export async function exportBackup(): Promise<string> {
  const exportedAt = new Date().toISOString()
  const data = await readBackupData()
  const backup = createBackup({
    ...data,
    settings: [
      ...data.settings.filter(({ key }) => key !== LAST_BACKUP_SETTING_KEY),
      { key: LAST_BACKUP_SETTING_KEY, value: exportedAt },
    ],
  }, exportedAt)
  const date = backup.exportedAt.slice(0, 10)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `uangq-backup-${date}.json`)
  return exportedAt
}

export async function importBackup(backup: BackupFile) {
  const validated = validateBackup(backup)
  await db.transaction(
    'rw',
    [
      db.wallets,
      db.categories,
      db.transactions,
      db.budgets,
      db.budgetItems,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.wallets.clear(),
        db.categories.clear(),
        db.transactions.clear(),
        db.budgets.clear(),
        db.budgetItems.clear(),
        db.settings.clear(),
      ])
      await Promise.all([
        db.wallets.bulkAdd(validated.data.wallets),
        db.categories.bulkAdd(validated.data.categories),
        db.transactions.bulkAdd(validated.data.transactions),
        db.budgets.bulkAdd(validated.data.budgets),
        db.budgetItems.bulkAdd(validated.data.budgetItems),
        db.settings.bulkAdd(validated.data.settings),
      ])
    },
  )
}
