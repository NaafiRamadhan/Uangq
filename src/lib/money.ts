const rupiahFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

export function formatRupiah(amount: number): string {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError('Nominal harus berupa bilangan bulat yang aman.')
  }

  return amount < 0
    ? `-Rp ${rupiahFormatter.format(-amount)}`
    : `Rp ${rupiahFormatter.format(amount)}`
}
