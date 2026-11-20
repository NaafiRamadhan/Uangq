import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { db, type Category, type Transaction, type Wallet } from '../../db/schema'
import { parseQuickEntry, type ParsedQuickEntry } from '../../lib/parser'
import { Button, Card, Input, MoneyInput } from '../../components/ui'

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="input-field">
      <span>{label}</span>
      <select className="input-control" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  )
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

type EditableDraft = Omit<ParsedQuickEntry, 'amount'> & { amount: number | '' }

export function QuickEntry({
  wallets,
  categories,
  defaultWalletId,
  focusOnMount = false,
  onInitialFocus,
  onSaved,
}: {
  wallets: readonly Wallet[]
  categories: readonly Category[]
  defaultWalletId: string
  focusOnMount?: boolean
  onInitialFocus?: () => void
  onSaved?: () => void | Promise<void>
}) {
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<EditableDraft | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const activeWallets = wallets.filter((wallet) => !wallet.archived)
  const activeCategories = categories.filter((category) => !category.archived)

  useEffect(() => {
    if (focusOnMount) onInitialFocus?.()
  }, [focusOnMount, onInitialFocus])

  function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    const result = parseQuickEntry(text, {
      wallets: activeWallets,
      categories: activeCategories,
      defaultWalletId,
    })
    if (!result.ok) {
      setDraft(null)
      setError(result.reason)
      return
    }
    setDraft(result.value)
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return

    const amount = draft.amount
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
      setError('Nominal harus berupa bilangan bulat rupiah yang lebih dari nol.')
      return
    }
    if (!isValidDate(draft.date)) {
      setError('Tanggal transaksi tidak valid.')
      return
    }
    if (!activeWallets.some((wallet) => wallet.id === draft.walletId)) {
      setError('Pilih dompet aktif sebelum menyimpan transaksi.')
      return
    }

    const category = activeCategories.find(({ id }) => id === draft.categoryId)
    if (draft.categoryId && (!category || (draft.type === 'income') !== (category.group === 'income'))) {
      setError('Kategori tidak sesuai dengan jenis transaksi.')
      return
    }

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      type: draft.type,
      amount,
      walletId: draft.walletId,
      ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
      note: draft.note.trim(),
      date: draft.date,
      createdAt: new Date().toISOString(),
    }

    try {
      await db.transactions.add(transaction)
      setDraft(null)
      setText('')
      setError('')
      setMessage('Transaksi tersimpan.')
      await onSaved?.()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Transaksi gagal disimpan.')
    }
  }

  return (
    <Card className="quick-entry-card">
      <div className="quick-entry__heading">
        <div>
          <p className="section-kicker">INPUT CEPAT</p>
          <h2>Catat transaksi</h2>
        </div>
        <span className="quick-entry__hint">Contoh: makan siang 25rb</span>
      </div>
      <form className="quick-entry__compose" onSubmit={createDraft}>
        <Input
          label="Tulis transaksi"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Misalnya: gaji 5jt bca"
          autoComplete="off"
          autoFocus={focusOnMount}
        />
        <Button type="submit">Buat draf</Button>
      </form>

      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {message && <p className="form-message" role="status">{message}</p>}

      {draft && (
        <form className="quick-entry__draft" onSubmit={(event) => void saveDraft(event)}>
          <h3>Periksa dan ubah draf</h3>
          <div className="transaction-form-grid">
            <SelectField
              label="Jenis transaksi"
              value={draft.type}
              onChange={(value) => {
                if (value !== 'expense' && value !== 'income') return
                setDraft({ ...draft, type: value, categoryId: undefined })
              }}
            >
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </SelectField>
            <MoneyInput
              label="Nominal (rupiah)"
              required
              value={draft.amount}
              onChange={(amount) => setDraft({ ...draft, amount })}
            />
            <SelectField
              label="Dompet"
              value={draft.walletId}
              onChange={(value) => setDraft({ ...draft, walletId: value })}
            >
              <option value="">Pilih dompet</option>
              {activeWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
            </SelectField>
            <SelectField
              label="Kategori (opsional)"
              value={draft.categoryId ?? ''}
              onChange={(value) => setDraft({ ...draft, categoryId: value || undefined })}
            >
              <option value="">Tanpa kategori</option>
              {activeCategories
                .filter((category) => draft.type === 'income'
                  ? category.group === 'income'
                  : category.group !== 'income')
                .map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </SelectField>
            <Input
              label="Tanggal"
              type="date"
              required
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
            />
            <Input
              label="Catatan"
              value={draft.note}
              maxLength={200}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            />
          </div>
          <div className="form-actions">
            <Button type="submit">Simpan transaksi</Button>
            <Button variant="secondary" type="button" onClick={() => setDraft(null)}>Batal</Button>
          </div>
        </form>
      )}
    </Card>
  )
}
