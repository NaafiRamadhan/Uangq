import type { Category, Wallet } from '../db/schema'

export type ParsedQuickEntry = {
  type: 'expense' | 'income'
  amount: number
  walletId: string
  categoryId?: string
  note: string
  date: string
}

export type ParseQuickEntryOptions = {
  wallets: readonly Pick<Wallet, 'id' | 'name'>[]
  categories: readonly Pick<Category, 'id' | 'name' | 'group'>[]
  defaultWalletId?: string
  today?: Date
}

export type ParseQuickEntryResult =
  | { ok: true; value: ParsedQuickEntry }
  | { ok: false; reason: string }

type TextMatch = {
  start: number
  end: number
  id: string
}

const moneyPattern =
  /(^|[^\p{L}\p{N}])(?:rp\s*)?(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)(?:\s*(ribu|juta|jt|rb|k))?(?=$|[^\p{L}\p{N}])/giu

const monthNumbers: Record<string, number> = {
  jan: 1, januari: 1,
  feb: 2, februari: 2,
  mar: 3, maret: 3,
  apr: 4, april: 4,
  mei: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  agu: 8, agustus: 8,
  sep: 9, september: 9,
  okt: 10, oktober: 10,
  nov: 11, november: 11,
  des: 12, desember: 12,
}

const monthPattern = Object.keys(monthNumbers)
  .sort((left, right) => right.length - left.length)
  .map(escapeRegExp)
  .join('|')

export function parseQuickEntry(
  input: string,
  options: ParseQuickEntryOptions,
): ParseQuickEntryResult {
  const today = options.today ?? new Date()
  if (Number.isNaN(today.getTime())) return { ok: false, reason: 'Tanggal acuan tidak valid.' }

  const dateResult = extractDate(input, today)
  if (!dateResult.ok) return dateResult

  let remainder = removeSpans(input, dateResult.spans)
  const walletMatches = findNamedMatches(remainder, options.wallets)
  const distinctWallets = new Set(walletMatches.map(({ id }) => id))
  if (distinctWallets.size > 1) {
    return { ok: false, reason: 'Sebutkan satu dompet saja dalam satu transaksi.' }
  }

  const walletId = walletMatches[0]?.id ??
    (options.defaultWalletId && options.wallets.some(({ id }) => id === options.defaultWalletId)
      ? options.defaultWalletId
      : '')
  remainder = removeSpans(remainder, walletMatches)

  const amountMatches = Array.from(remainder.matchAll(moneyPattern))
  if (amountMatches.length === 0) {
    return { ok: false, reason: 'Nominal transaksi tidak ditemukan.' }
  }
  if (amountMatches.length > 1) {
    return { ok: false, reason: 'Terdapat lebih dari satu nominal; tulis satu transaksi saja.' }
  }

  const amountMatch = amountMatches[0]
  const amountIndex = amountMatch.index
  if (amountIndex === undefined) return { ok: false, reason: 'Nominal transaksi tidak dapat dibaca.' }
  if (amountMatch[1].trim().endsWith('-') || amountMatch[1].trim().endsWith('−')) {
    return { ok: false, reason: 'Nominal transaksi harus positif.' }
  }

  let amount: number
  try {
    amount = parseAmount(amountMatch[2], amountMatch[3] ?? '')
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Format nominal tidak valid.',
    }
  }
  if (amount <= 0) return { ok: false, reason: 'Nominal transaksi harus lebih dari nol.' }

  remainder = removeSpans(remainder, [{
    start: amountIndex + amountMatch[1].length,
    end: amountIndex + amountMatch[0].length,
    id: '',
  }])

  const type = hasIncomeKeyword(remainder) ? 'income' : 'expense'
  const possibleCategories = options.categories.filter((category) => (
    type === 'income' ? category.group === 'income' : category.group !== 'income'
  ))
  const categoryMatches = findNamedMatches(remainder, possibleCategories)
  const categoryIds = new Set(categoryMatches.map(({ id }) => id))
  const categoryId = categoryIds.size === 1 ? categoryMatches[0].id : undefined

  return {
    ok: true,
    value: {
      type,
      amount,
      walletId,
      ...(categoryId ? { categoryId } : {}),
      note: normalizeNote(remainder),
      date: dateResult.date,
    },
  }
}

function extractDate(
  input: string,
  today: Date,
): { ok: true; date: string; spans: TextMatch[] } | { ok: false; reason: string } {
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const matches: Array<TextMatch & { date: string | null }> = []

  for (const match of input.matchAll(/\b(hari\s+ini|kemarin|lusa\s+lalu)\b/giu)) {
    const phrase = match[1].toLocaleLowerCase('id-ID').replace(/\s+/g, ' ')
    const date = new Date(localToday)
    if (phrase === 'kemarin') date.setDate(date.getDate() - 1)
    if (phrase === 'lusa lalu') date.setDate(date.getDate() - 2)
    matches.push({ start: match.index!, end: match.index! + match[0].length, id: '', date: formatLocalDate(date) })
  }

  for (const match of input.matchAll(/\btgl\s+(\d{1,2})\b/giu)) {
    matches.push({
      start: match.index!,
      end: match.index! + match[0].length,
      id: '',
      date: dateInMonth(localToday.getFullYear(), localToday.getMonth() + 1, Number(match[1])),
    })
  }

  const namedDatePattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])(\\d{1,2})\\s+(${monthPattern})(?=$|[^\\p{L}\\p{N}])`,
    'giu',
  )
  for (const match of input.matchAll(namedDatePattern)) {
    const monthName = match[3].toLocaleLowerCase('id-ID')
    matches.push({
      start: match.index! + match[1].length,
      end: match.index! + match[0].length,
      id: '',
      date: dateInMonth(localToday.getFullYear(), monthNumbers[monthName], Number(match[2])),
    })
  }

  if (matches.length > 1) return { ok: false, reason: 'Terdapat lebih dari satu tanggal; gunakan satu tanggal saja.' }
  if (matches.length === 1 && matches[0].date === null) {
    return { ok: false, reason: 'Tanggal transaksi tidak valid.' }
  }

  return {
    ok: true,
    date: matches[0]?.date ?? formatLocalDate(localToday),
    spans: matches,
  }
}

function dateInMonth(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return formatLocalDate(date)
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseAmount(numberText: string, suffix: string): number {
  const normalizedSuffix = suffix.toLocaleLowerCase('id-ID')
  const multiplier = normalizedSuffix === 'juta' || normalizedSuffix === 'jt'
    ? 1_000_000n
    : normalizedSuffix
      ? 1_000n
      : 1n

  let integerText = numberText
  let fractionalText = ''
  if (numberText.includes(',')) {
    if (!suffix) throw new Error('Gunakan koma desimal bersama satuan rb, k, jt, atau juta.')
    ;[integerText, fractionalText] = numberText.split(',')
  } else if (numberText.includes('.')) {
    if (/^\d{1,3}(?:\.\d{3})+$/.test(numberText)) {
      integerText = numberText.replaceAll('.', '')
    } else if (suffix) {
      ;[integerText, fractionalText] = numberText.split('.')
    } else {
      throw new Error('Titik hanya digunakan sebagai pemisah ribuan.')
    }
  }

  let amount: bigint
  if (fractionalText) {
    const divisor = 10n ** BigInt(fractionalText.length)
    const numerator = BigInt(`${integerText}${fractionalText}`) * multiplier
    if (numerator % divisor !== 0n) {
      throw new Error('Hasil nominal harus berupa rupiah bulat.')
    }
    amount = numerator / divisor
  } else {
    amount = BigInt(integerText) * multiplier
  }

  const numericAmount = Number(amount)
  if (!Number.isSafeInteger(numericAmount)) {
    throw new Error('Nominal berada di luar rentang bilangan bulat yang aman.')
  }
  return numericAmount
}

function findNamedMatches<T extends { id: string; name: string }>(
  text: string,
  items: readonly T[],
): TextMatch[] {
  const matches: TextMatch[] = []
  for (const item of items) {
    const namePattern = escapeRegExp(item.name.trim()).replace(/\s+/g, '\\s+')
    if (!namePattern) continue
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${namePattern})(?=$|[^\\p{L}\\p{N}])`, 'giu')
    for (const match of text.matchAll(pattern)) {
      matches.push({
        start: match.index! + match[1].length,
        end: match.index! + match[0].length,
        id: item.id,
      })
    }
  }
  return longestMatches(matches)
}

function longestMatches(matches: TextMatch[]): TextMatch[] {
  const ordered = [...matches].sort((left, right) => (
    left.start - right.start || (right.end - right.start) - (left.end - left.start)
  ))
  return ordered.filter((match) => !ordered.some((other) => (
    other !== match &&
    other.start <= match.start &&
    other.end >= match.end &&
    other.end - other.start > match.end - match.start
  )))
}

function removeSpans(text: string, spans: readonly TextMatch[]): string {
  return [...spans]
    .sort((left, right) => right.start - left.start)
    .reduce((result, span) => `${result.slice(0, span.start)} ${result.slice(span.end)}`, text)
}

function hasIncomeKeyword(text: string): boolean {
  return /(^|[^\p{L}\p{N}])(gaji|terima|bonus|masuk)(?=$|[^\p{L}\p{N}])/iu.test(text)
}

function normalizeNote(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/^[,;|]+|[,;|]+$/g, '').trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
