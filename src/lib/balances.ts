import type { Transaction, Wallet } from '../db/schema'

type WalletBalanceSource = Pick<Wallet, 'id' | 'initialBalance'>

export function calculateWalletBalances(
  wallets: readonly WalletBalanceSource[],
  transactions: readonly Transaction[],
): ReadonlyMap<string, number> {
  const balances = new Map<string, bigint>()

  for (const wallet of wallets) {
    if (!Number.isSafeInteger(wallet.initialBalance)) {
      throw new RangeError(`Saldo awal dompet ${wallet.id} harus berupa bilangan bulat yang aman.`)
    }
    if (balances.has(wallet.id)) {
      throw new Error(`Dompet duplikat: ${wallet.id}.`)
    }
    balances.set(wallet.id, BigInt(wallet.initialBalance))
  }

  for (const transaction of transactions) {
    if (!Number.isSafeInteger(transaction.amount) || transaction.amount <= 0) {
      throw new RangeError(`Nominal transaksi ${transaction.id} harus berupa bilangan bulat positif.`)
    }

    const sourceBalance = balances.get(transaction.walletId)
    if (sourceBalance === undefined) {
      throw new Error(`Dompet sumber transaksi ${transaction.id} tidak ditemukan.`)
    }
    const amount = BigInt(transaction.amount)

    if (transaction.type === 'expense') {
      balances.set(transaction.walletId, sourceBalance - amount)
    } else if (transaction.type === 'income') {
      balances.set(transaction.walletId, sourceBalance + amount)
    } else {
      const destinationId = transaction.toWalletId
      if (!destinationId || destinationId === transaction.walletId) {
        throw new Error(`Tujuan transfer transaksi ${transaction.id} tidak valid.`)
      }

      const destinationBalance = balances.get(destinationId)
      if (destinationBalance === undefined) {
        throw new Error(`Dompet tujuan transaksi ${transaction.id} tidak ditemukan.`)
      }

      balances.set(transaction.walletId, sourceBalance - amount)
      balances.set(destinationId, destinationBalance + amount)
    }
  }

  const result = new Map<string, number>()
  for (const [walletId, balance] of balances) {
    const numericBalance = Number(balance)
    if (!Number.isSafeInteger(numericBalance)) {
      throw new RangeError(`Saldo dompet ${walletId} berada di luar rentang bilangan bulat yang aman.`)
    }
    result.set(walletId, numericBalance)
  }
  return result
}
