import Dexie, { type EntityTable } from 'dexie'

export type Wallet = {
  id: string
  name: string
  type: 'bank' | 'ewallet' | 'credit_card' | 'paylater' | 'cash'
  initialBalance: number
  archived: boolean
  createdAt: string
}

export type Category = {
  id: string
  name: string
  group: 'needs' | 'wants' | 'savings' | 'income'
  icon: string
  archived: boolean
}

export type Transaction = {
  id: string
  type: 'expense' | 'income' | 'transfer'
  amount: number
  walletId: string
  toWalletId?: string
  categoryId?: string
  note: string
  date: string
  createdAt: string
}

export type Budget = {
  id: string
  month: string
  total: number
  splitNeeds: number
  splitWants: number
  splitSavings: number
}

export type BudgetItem = {
  id: string
  month: string
  categoryId: string
  limit: number
}

export type Setting = {
  key: string
  value: unknown
}

export class UangqDatabase extends Dexie {
  wallets!: EntityTable<Wallet, 'id'>
  categories!: EntityTable<Category, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  budgets!: EntityTable<Budget, 'id'>
  budgetItems!: EntityTable<BudgetItem, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor() {
    super('uangq')
    this.version(1).stores({
      wallets: 'id, name, type, archived',
      categories: 'id, name, group, archived',
      transactions: 'id, type, walletId, toWalletId, categoryId, date',
      budgets: 'id, month',
      budgetItems: 'id, month, categoryId',
      settings: 'key',
    })
  }
}

export const db = new UangqDatabase()

export async function seedDatabase() {
  await db.transaction('rw', db.categories, async () => {
    if (await db.categories.count()) return

    const seeds: Omit<Category, 'archived'>[] = [
      { id: crypto.randomUUID(), name: 'Makan', group: 'needs', icon: 'utensils' },
      { id: crypto.randomUUID(), name: 'Listrik', group: 'needs', icon: 'bolt' },
      { id: crypto.randomUUID(), name: 'Air', group: 'needs', icon: 'droplet' },
      { id: crypto.randomUUID(), name: 'Transportasi', group: 'needs', icon: 'bus' },
      { id: crypto.randomUUID(), name: 'Kuota/Internet', group: 'needs', icon: 'wifi' },
      { id: crypto.randomUUID(), name: 'Kebutuhan Lain', group: 'needs', icon: 'box' },
      { id: crypto.randomUUID(), name: 'Hangout', group: 'wants', icon: 'coffee' },
      { id: crypto.randomUUID(), name: 'Belanja Online', group: 'wants', icon: 'bag' },
      { id: crypto.randomUUID(), name: 'Hobi', group: 'wants', icon: 'palette' },
      { id: crypto.randomUUID(), name: 'Tabungan', group: 'savings', icon: 'piggy-bank' },
      { id: crypto.randomUUID(), name: 'Dana Darurat', group: 'savings', icon: 'shield' },
      { id: crypto.randomUUID(), name: 'Gaji', group: 'income', icon: 'briefcase' },
      { id: crypto.randomUUID(), name: 'Pemasukan Lain', group: 'income', icon: 'plus' },
    ]
    await db.categories.bulkAdd(seeds.map((category) => ({ ...category, archived: false })))
  })
}

export async function requestPersistentStorage() {
  if ('storage' in navigator && navigator.storage?.persist) {
    await navigator.storage.persist()
  }
}
