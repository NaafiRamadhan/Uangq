import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { db, seedDatabase, type Category, type Transaction, type Wallet } from '../../db/schema'
import { formatRupiah } from '../../lib/money'
import { Button, Card, EmptyState, Input } from '../../components/ui'
import { QuickEntry } from './QuickEntry'

type TransactionDraft = {
  type: Transaction['type']
  amount: string
  walletId: string
  toWalletId: string
  categoryId: string
  note: string
  date: string
}

type TransactionFilter = '' | Transaction['type']

function isTransactionType(value: string): value is Transaction['type'] {
  return value === 'expense' || value === 'income' || value === 'transfer'
}

function localDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function newDraft(walletId = ''): TransactionDraft {
  return {
    type: 'expense',
    amount: '',
    walletId,
    toWalletId: '',
    categoryId: '',
    note: '',
    date: localDateString(),
  }
}

function transactionFromDraft(draft: TransactionDraft, existing?: Transaction): Transaction {
  const amount = Number(draft.amount)
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Nominal transaksi harus berupa bilangan bulat rupiah yang lebih dari nol.')
  }
  if (!draft.walletId) throw new Error('Pilih dompet transaksi.')
  if (!isValidDateString(draft.date)) {
    throw new Error('Tanggal transaksi tidak valid.')
  }
  if (draft.type === 'transfer' && (!draft.toWalletId || draft.walletId === draft.toWalletId)) {
    throw new Error('Pilih dompet tujuan yang berbeda dari dompet sumber.')
  }

  return {
    id: existing?.id ?? crypto.randomUUID(),
    type: draft.type,
    amount,
    walletId: draft.walletId,
    ...(draft.type === 'transfer' ? { toWalletId: draft.toWalletId } : {}),
    ...(draft.type !== 'transfer' && draft.categoryId ? { categoryId: draft.categoryId } : {}),
    note: draft.note.trim(),
    date: draft.date,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }
}

function draftFromTransaction(transaction: Transaction): TransactionDraft {
  return {
    type: transaction.type,
    amount: String(transaction.amount),
    walletId: transaction.walletId,
    toWalletId: transaction.toWalletId ?? '',
    categoryId: transaction.categoryId ?? '',
    note: transaction.note,
    date: transaction.date,
  }
}

function SelectField({
  label,
  value,
  onChange,
  children,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="input-field">
      <span>{label}</span>
      <select
        className="input-control"
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  )
}

function dateHeading(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function formatTransactionAmount(transaction: Transaction): string {
  const prefix = transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : ''
  return `${prefix}${formatRupiah(transaction.amount)}`
}

export function TransactionsPage({
  onOpenWallets,
  defaultWalletId,
}: {
  onOpenWallets: () => void
  defaultWalletId: string
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [singleDraft, setSingleDraft] = useState<TransactionDraft | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [bulkDrafts, setBulkDrafts] = useState<TransactionDraft[]>([])
  const [search, setSearch] = useState('')
  const [filterWallet, setFilterWallet] = useState('')
  const [filterType, setFilterType] = useState<TransactionFilter>('')
  const [filterCategory, setFilterCategory] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  async function loadTransactions(showLoading = true) {
    if (showLoading) setLoading(true)
    try {
      await seedDatabase()
      const [nextTransactions, nextWallets, nextCategories] = await Promise.all([
        db.transactions.toArray(),
        db.wallets.toArray(),
        db.categories.toArray(),
      ])
      setTransactions(nextTransactions)
      setWallets(nextWallets)
      setCategories(nextCategories)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Transaksi gagal dimuat.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    void loadTransactions()
  }, [])

  const activeWallets = wallets.filter((wallet) => !wallet.archived)
  const availableCategories = categories.filter((category) => !category.archived)
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  )
  const walletNames = useMemo(
    () => new Map(wallets.map((wallet) => [wallet.id, wallet.name])),
    [wallets],
  )

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id')
    return transactions
      .filter((transaction) => {
        if (dateFrom && transaction.date < dateFrom) return false
        if (dateTo && transaction.date > dateTo) return false
        if (filterWallet && transaction.walletId !== filterWallet && transaction.toWalletId !== filterWallet) return false
        if (filterType && transaction.type !== filterType) return false
        if (filterCategory && transaction.categoryId !== filterCategory) return false
        if (query && !transaction.note.toLocaleLowerCase('id').includes(query)) return false
        return true
      })
      .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
  }, [transactions, dateFrom, dateTo, filterWallet, filterType, filterCategory, search])

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    for (const transaction of filteredTransactions) {
      const group = groups.get(transaction.date) ?? []
      group.push(transaction)
      groups.set(transaction.date, group)
    }
    return Array.from(groups.entries())
  }, [filteredTransactions])

  function startCreate() {
    if (!activeWallets.length) return
    setError('')
    setMessage('')
    setEditingTransaction(null)
    setSingleDraft(newDraft(activeWallets[0].id))
    setBulkDrafts([])
  }

  function startEdit(transaction: Transaction) {
    setError('')
    setMessage('')
    setEditingTransaction(transaction)
    setSingleDraft(draftFromTransaction(transaction))
    setBulkDrafts([])
  }

  function startBulkEntry() {
    if (!activeWallets.length) return
    setError('')
    setMessage('')
    setEditingTransaction(null)
    setSingleDraft(null)
    setBulkDrafts([newDraft(activeWallets[0].id), newDraft(activeWallets[0].id)])
  }

  function closeForms() {
    setSingleDraft(null)
    setEditingTransaction(null)
    setBulkDrafts([])
    setError('')
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!singleDraft) return

    try {
      const transaction = transactionFromDraft(singleDraft, editingTransaction ?? undefined)
      await db.transactions.put(transaction)
      await loadTransactions()
      setSingleDraft(null)
      setEditingTransaction(null)
      setMessage(editingTransaction ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil ditambahkan.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Transaksi gagal disimpan.')
    }
  }

  async function saveBulkTransactions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const newTransactions = bulkDrafts.map((draft) => transactionFromDraft(draft))
      await db.transaction('rw', db.transactions, async () => {
        await db.transactions.bulkAdd(newTransactions)
      })
      await loadTransactions()
      setBulkDrafts([])
      setMessage(`${newTransactions.length} transaksi berhasil ditambahkan.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Transaksi massal gagal disimpan.')
    }
  }

  async function deleteTransaction(transaction: Transaction) {
    if (!window.confirm('Hapus transaksi ini? Saldo dompet akan dihitung ulang.')) return
    try {
      if (!(await db.transactions.get(transaction.id))) throw new Error('Transaksi tidak ditemukan.')
      await db.transactions.delete(transaction.id)
      await loadTransactions()
      setMessage('Transaksi berhasil dihapus.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Transaksi gagal dihapus.')
    }
  }

  function updateBulkDraft(index: number, patch: Partial<TransactionDraft>) {
    setBulkDrafts((drafts) => drafts.map((draft, itemIndex) => (
      itemIndex === index ? { ...draft, ...patch } : draft
    )))
  }

  function clearFilters() {
    setSearch('')
    setFilterWallet('')
    setFilterType('')
    setFilterCategory('')
    setDateFrom('')
    setDateTo('')
  }

  function renderTransactionFields(
    draft: TransactionDraft,
    update: (patch: Partial<TransactionDraft>) => void,
    keyPrefix: string,
  ) {
    const formWallets = wallets.filter((wallet) => (
      !wallet.archived || wallet.id === draft.walletId || wallet.id === draft.toWalletId
    ))
    const formCategories = availableCategories.filter((category) => (
      draft.type === 'income' ? category.group === 'income' : category.group !== 'income'
    ))

    return (
      <>
        <SelectField
          label="Jenis transaksi"
          value={draft.type}
          required
          onChange={(value) => {
            if (!isTransactionType(value)) return
            update({
              type: value,
              categoryId: '',
              toWalletId: value === 'transfer' ? draft.toWalletId : '',
            })
          }}
        >
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
          <option value="transfer">Transfer</option>
        </SelectField>
        <Input
          label="Nominal (rupiah)"
          type="number"
          inputMode="numeric"
          step="1"
          min="1"
          required
          value={draft.amount}
          onChange={(event) => update({ amount: event.target.value })}
          placeholder="Contoh: 25000"
        />
        <SelectField
          label={draft.type === 'transfer' ? 'Dompet sumber' : 'Dompet'}
          value={draft.walletId}
          required
          onChange={(value) => update({ walletId: value })}
        >
          <option value="">Pilih dompet</option>
          {formWallets.map((wallet) => (
            <option key={`${keyPrefix}-wallet-${wallet.id}`} value={wallet.id}>
              {wallet.name}{wallet.archived ? ' (diarsipkan)' : ''}
            </option>
          ))}
        </SelectField>
        {draft.type === 'transfer' ? (
          <SelectField
            label="Dompet tujuan"
            value={draft.toWalletId}
            required
            onChange={(value) => update({ toWalletId: value })}
          >
            <option value="">Pilih dompet tujuan</option>
            {formWallets
              .filter((wallet) => wallet.id !== draft.walletId)
              .map((wallet) => (
                <option key={`${keyPrefix}-destination-${wallet.id}`} value={wallet.id}>
                  {wallet.name}{wallet.archived ? ' (diarsipkan)' : ''}
                </option>
              ))}
          </SelectField>
        ) : (
          <SelectField
            label="Kategori (opsional)"
            value={draft.categoryId}
            onChange={(value) => update({ categoryId: value })}
          >
            <option value="">Tanpa kategori</option>
            {formCategories.map((category) => (
              <option key={`${keyPrefix}-category-${category.id}`} value={category.id}>{category.name}</option>
            ))}
          </SelectField>
        )}
        <Input
          label="Tanggal"
          type="date"
          required
          value={draft.date}
          onChange={(event) => update({ date: event.target.value })}
        />
        <Input
          label="Catatan"
          autoComplete="off"
          maxLength={200}
          value={draft.note}
          onChange={(event) => update({ note: event.target.value })}
          placeholder="Misalnya: makan siang"
        />
      </>
    )
  }

  if (loading) {
    return <p className="feature-description" role="status">Memuat transaksi…</p>
  }

  if (activeWallets.length === 0 && !singleDraft && bulkDrafts.length === 0) {
    return (
      <div className="feature-page">
        {error && <p className="form-message form-message--error" role="alert">{error}</p>}
        <QuickEntry
          wallets={wallets}
          categories={categories}
          defaultWalletId={defaultWalletId}
          onSaved={() => loadTransactions(false)}
        />
        <EmptyState
          title="Buat dompet sebelum mencatat transaksi"
          action={<Button type="button" onClick={onOpenWallets}>Buat dompet</Button>}
        >
          Transaksi memerlukan dompet sumber. Tambahkan dompet pertamamu terlebih dahulu.
        </EmptyState>
        {transactions.length > 0 && <p className="feature-description">Transaksi lama tetap tersimpan dan bisa dilihat setelah dompet dipulihkan.</p>}
      </div>
    )
  }

  return (
    <div className="feature-page">
      <QuickEntry
        wallets={wallets}
        categories={categories}
        defaultWalletId={defaultWalletId}
        onSaved={() => loadTransactions(false)}
      />
      <div className="feature-toolbar">
        <p className="feature-description">Catat pemasukan, pengeluaran, dan perpindahan saldo.</p>
        <div className="toolbar-actions">
          <Button type="button" onClick={startCreate}>Tambah transaksi</Button>
          <Button variant="secondary" type="button" onClick={startBulkEntry}>Input beberapa</Button>
        </div>
      </div>

      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {message && <p className="form-message" role="status">{message}</p>}

      {singleDraft && (
        <Card className="feature-form-card">
          <h2>{editingTransaction ? 'Ubah transaksi' : 'Transaksi baru'}</h2>
          <form className="feature-form" onSubmit={(event) => void saveTransaction(event)}>
            <div className="transaction-form-grid">
              {renderTransactionFields(singleDraft, (patch) => setSingleDraft({ ...singleDraft, ...patch }), 'single')}
            </div>
            <div className="form-actions">
              <Button type="submit">{editingTransaction ? 'Simpan perubahan' : 'Simpan transaksi'}</Button>
              <Button variant="secondary" type="button" onClick={closeForms}>Batal</Button>
            </div>
          </form>
        </Card>
      )}

      {bulkDrafts.length > 0 && (
        <Card className="feature-form-card">
          <h2>Input beberapa transaksi</h2>
          <p className="backup-note">Isi setiap baris, lalu simpan bersama-sama.</p>
          <form className="feature-form" onSubmit={(event) => void saveBulkTransactions(event)}>
            <div className="bulk-entry-list">
              {bulkDrafts.map((draft, index) => (
                <div className="bulk-entry" key={index}>
                  <div className="bulk-entry__heading">
                    <h3>Transaksi {index + 1}</h3>
                    {bulkDrafts.length > 1 && (
                      <Button
                        variant="secondary"
                        type="button"
                        className="button--compact"
                        onClick={() => setBulkDrafts((drafts) => drafts.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        Hapus baris
                      </Button>
                    )}
                  </div>
                  <div className="transaction-form-grid">
                    {renderTransactionFields(draft, (patch) => updateBulkDraft(index, patch), `bulk-${index}`)}
                  </div>
                </div>
              ))}
            </div>
            <div className="form-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setBulkDrafts((drafts) => [...drafts, newDraft(activeWallets[0]?.id)])}
              >
                Tambah baris
              </Button>
              <Button type="submit">Simpan {bulkDrafts.length} transaksi</Button>
              <Button variant="secondary" type="button" onClick={closeForms}>Batal</Button>
            </div>
          </form>
        </Card>
      )}

      {transactions.length === 0 ? (
        <EmptyState
          title="Catat transaksi pertamamu"
          action={<Button type="button" onClick={startCreate}>Tambah transaksi</Button>}
        >
          Simpan pemasukan, pengeluaran, atau transfer agar saldo dompetmu tercatat.
        </EmptyState>
      ) : (
        <>
          <Card className="transaction-filters">
            <div className="filter-grid">
              <Input
                label="Cari catatan"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ketik kata kunci"
              />
              <Input
                label="Dari tanggal"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
              <Input
                label="Sampai tanggal"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
              <SelectField label="Dompet" value={filterWallet} onChange={setFilterWallet}>
                <option value="">Semua dompet</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name}{wallet.archived ? ' (diarsipkan)' : ''}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Jenis"
                value={filterType}
                onChange={(value) => setFilterType(isTransactionType(value) ? value : '')}
              >
                <option value="">Semua jenis</option>
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
                <option value="transfer">Transfer</option>
              </SelectField>
              <SelectField label="Kategori" value={filterCategory} onChange={setFilterCategory}>
                <option value="">Semua kategori</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </SelectField>
            </div>
            <div className="filter-summary">
              <p>{filteredTransactions.length} transaksi</p>
              <Button variant="secondary" type="button" className="button--compact" onClick={clearFilters}>
                Hapus filter
              </Button>
            </div>
          </Card>

          {groupedTransactions.length === 0 ? (
            <EmptyState title="Transaksi tidak ditemukan">
              Coba ubah pencarian atau filter untuk melihat transaksi lainnya.
            </EmptyState>
          ) : (
            <div className="transaction-day-list">
              {groupedTransactions.map(([date, dayTransactions]) => (
                <Card className="transaction-day" key={date}>
                  <h2>{dateHeading(date)}</h2>
                  <div className="transaction-list">
                    {dayTransactions.map((transaction) => {
                      const description = transaction.type === 'transfer'
                        ? `Transfer ${walletNames.get(transaction.walletId) ?? 'Dompet'} ke ${walletNames.get(transaction.toWalletId ?? '') ?? 'Dompet'}`
                        : categoryNames.get(transaction.categoryId ?? '') ?? (transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran')
                      return (
                        <article className="transaction-row" key={transaction.id}>
                          <div className="transaction-row__info">
                            <h3>{description}</h3>
                            <p>{transaction.note || walletNames.get(transaction.walletId) || 'Tanpa catatan'}</p>
                          </div>
                          <div className="transaction-row__side">
                            <strong className={`transaction-amount transaction-amount--${transaction.type}`}>
                              {formatTransactionAmount(transaction)}
                            </strong>
                            <div className="transaction-row__actions">
                              <button type="button" onClick={() => startEdit(transaction)}>Ubah</button>
                              <button type="button" onClick={() => void deleteTransaction(transaction)}>Hapus</button>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
