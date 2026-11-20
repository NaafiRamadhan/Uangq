const rupiahFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

export type MoneyInputValue = number | ''

export function parseMoneyInput(input: string): MoneyInputValue | null {
  const digits = input.replace(/\D/g, '')
  if (digits === '') return ''

  const normalized = digits.replace(/^0+(?=\d)/, '')
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) ? amount : null
}

export function formatMoneyInput(value: MoneyInputValue | string): string {
  if (value === '') return ''

  const amount = typeof value === 'number' ? value : parseMoneyInput(value)
  if (amount === '') return ''
  if (amount === null || !Number.isSafeInteger(amount)) {
    throw new RangeError('Nominal harus berupa bilangan bulat rupiah yang aman.')
  }

  const sign = amount < 0 ? '-' : ''
  return `${sign}${String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

export function getMoneyInputCaretPosition(
  formattedValue: string,
  digitsBeforeCaret: number,
): number {
  const targetDigits = Math.max(0, Math.trunc(digitsBeforeCaret))
  if (targetDigits === 0) return 0

  let seenDigits = 0
  for (let index = 0; index < formattedValue.length; index += 1) {
    if (/\d/.test(formattedValue[index])) {
      seenDigits += 1
      if (seenDigits === targetDigits) return index + 1
    }
  }

  return formattedValue.length
}

export function formatRupiah(amount: number): string {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError('Nominal harus berupa bilangan bulat yang aman.')
  }

  return amount < 0
    ? `-Rp ${rupiahFormatter.format(-amount)}`
    : `Rp ${rupiahFormatter.format(amount)}`
}
