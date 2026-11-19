import type { Category, Transaction, Wallet } from '../db/schema'

const headers = ['tanggal', 'tipe', 'jumlah', 'dompet', 'kategori', 'catatan']
const transactionTypeLabels: Record<Transaction['type'], string> = {
  expense: 'Pengeluaran',
  income: 'Pemasukan',
  transfer: 'Transfer',
}

export function createTransactionsCsv(
  transactions: readonly Transaction[],
  wallets: readonly Wallet[],
  categories: readonly Category[],
): string {
  const walletNames = new Map(wallets.map(({ id, name }) => [id, name]))
  const categoryNames = new Map(categories.map(({ id, name }) => [id, name]))
  const rows = transactions.map((transaction) => {
    const sourceWallet = walletNames.get(transaction.walletId) ?? 'Dompet tidak ditemukan'
    const destinationWallet = transaction.toWalletId
      ? walletNames.get(transaction.toWalletId) ?? 'Dompet tidak ditemukan'
      : 'Dompet tidak ditemukan'
    const wallet = transaction.type === 'transfer'
      ? `${sourceWallet} → ${destinationWallet}`
      : sourceWallet
    const category = transaction.type === 'transfer'
      ? ''
      : categoryNames.get(transaction.categoryId ?? '') ?? 'Tanpa kategori'

    return [
      transaction.date,
      transactionTypeLabels[transaction.type],
      String(transaction.amount),
      wallet,
      category,
      transaction.note,
    ]
  })

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvField).join(','))
    .join('\r\n')
}

function escapeCsvField(value: string): string {
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safeValue.replace(/"/g, '""')}"`
}
