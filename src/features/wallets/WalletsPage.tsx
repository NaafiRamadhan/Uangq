import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { db, type Transaction, type Wallet } from '../../db/schema'
import { calculateWalletBalances } from '../../lib/balances'
import { formatRupiah } from '../../lib/money'
import { Button, Card, EmptyState, Input, MoneyInput } from '../../components/ui'

const walletTypes: { value: Wallet['type']; label: string }[] = [
  { value: 'bank', label: 'Rekening bank' },
  { value: 'ewallet', label: 'Dompet digital' },
  { value: 'credit_card', label: 'Kartu kredit' },
  { value: 'paylater', label: 'Paylater' },
  { value: 'cash', label: 'Tunai' },
]

function isWalletType(value: string): value is Wallet['type'] {
  return walletTypes.some((type) => type.value === value)
}

type WalletDraft = {
  name: string
  type: Wallet['type']
  initialBalance: number | ''
}

const newWalletDraft = (): WalletDraft => ({
  name: '',
  type: 'bank',
  initialBalance: 0,
})

export function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [draft, setDraft] = useState<WalletDraft>(newWalletDraft)
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadWallets() {
    setLoading(true)
    try {
      const [nextWallets, nextTransactions] = await Promise.all([
        db.wallets.toArray(),
        db.transactions.toArray(),
      ])
      setWallets(nextWallets)
      setTransactions(nextTransactions)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Dompet gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadWallets()
  }, [])

  const balanceResult = useMemo(() => {
    try {
      return { balances: calculateWalletBalances(wallets, transactions), error: '' }
    } catch (calculationError) {
      return {
        balances: new Map<string, number>(),
        error: calculationError instanceof Error ? calculationError.message : 'Saldo dompet gagal dihitung.',
      }
    }
  }, [wallets, transactions])

  const visibleWallets = wallets
    .filter((wallet) => showArchived || !wallet.archived)
    .sort((left, right) => Number(left.archived) - Number(right.archived) || left.name.localeCompare(right.name, 'id'))

  function startCreate() {
    setEditingWallet(null)
    setDraft(newWalletDraft())
    setFormOpen(true)
    setError('')
  }

  function startEdit(wallet: Wallet) {
    setEditingWallet(wallet)
    setDraft({
      name: wallet.name,
      type: wallet.type,
      initialBalance: wallet.initialBalance,
    })
    setFormOpen(true)
    setError('')
  }

  async function saveWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = draft.name.trim()
    const initialBalance = draft.initialBalance

    if (!name) {
      setError('Nama dompet wajib diisi.')
      return
    }
    if (typeof initialBalance !== 'number' || !Number.isSafeInteger(initialBalance)) {
      setError('Saldo awal harus berupa bilangan bulat rupiah.')
      return
    }

    const wallet: Wallet = {
      id: editingWallet?.id ?? crypto.randomUUID(),
      name,
      type: draft.type,
      initialBalance,
      archived: editingWallet?.archived ?? false,
      createdAt: editingWallet?.createdAt ?? new Date().toISOString(),
    }

    try {
      await db.wallets.put(wallet)
      await loadWallets()
      setFormOpen(false)
      setEditingWallet(null)
      setDraft(newWalletDraft())
      setMessage(editingWallet ? 'Dompet berhasil diperbarui.' : 'Dompet berhasil ditambahkan.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Dompet gagal disimpan.')
    }
  }

  async function toggleArchived(wallet: Wallet) {
    try {
      const updated = await db.wallets.update(wallet.id, { archived: !wallet.archived })
      if (!updated) throw new Error('Dompet tidak ditemukan.')
      await loadWallets()
      setMessage(wallet.archived ? 'Dompet dipulihkan.' : 'Dompet diarsipkan.')
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Status arsip dompet gagal diperbarui.')
    }
  }

  function closeForm() {
    setFormOpen(false)
    setEditingWallet(null)
    setDraft(newWalletDraft())
    setError('')
  }

  return (
    <div className="feature-page">
      <div className="feature-toolbar">
        <p className="feature-description">Atur rekening, uang tunai, dan saldo awal.</p>
        <Button type="button" onClick={startCreate}>Tambah dompet</Button>
      </div>

      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {balanceResult.error && <p className="form-message form-message--error" role="alert">{balanceResult.error}</p>}
      {message && <p className="form-message" role="status">{message}</p>}

      {formOpen && (
        <Card className="feature-form-card">
          <h2>{editingWallet ? 'Ubah dompet' : 'Dompet baru'}</h2>
          <form className="feature-form" onSubmit={(event) => void saveWallet(event)}>
            <Input
              label="Nama dompet"
              autoComplete="off"
              maxLength={60}
              required
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Contoh: Tunai harian"
            />
            <label className="input-field">
              <span>Jenis dompet</span>
              <select
                className="input-control"
                required
                value={draft.type}
                onChange={(event) => {
                  if (isWalletType(event.target.value)) setDraft({ ...draft, type: event.target.value })
                }}
              >
                {walletTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <MoneyInput
              label="Saldo awal (rupiah)"
              required
              value={draft.initialBalance}
              onChange={(initialBalance) => setDraft({ ...draft, initialBalance })}
            />
            <div className="form-actions">
              <Button type="submit">{editingWallet ? 'Simpan perubahan' : 'Simpan dompet'}</Button>
              <Button variant="secondary" type="button" onClick={closeForm}>Batal</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="list-heading">
        <h2>{showArchived ? 'Semua dompet' : 'Dompet aktif'}</h2>
        <Button
          variant="secondary"
          type="button"
          className="button--compact"
          aria-pressed={showArchived}
          onClick={() => setShowArchived((visible) => !visible)}
        >
          {showArchived ? 'Sembunyikan arsip' : 'Lihat arsip'}
        </Button>
      </div>

      {loading ? (
        <p className="feature-description" role="status">Memuat dompet…</p>
      ) : visibleWallets.length === 0 ? (
        <EmptyState title="Buat dompet pertamamu">
          Catat rekening, uang tunai, atau dompet digital agar transaksimu punya sumber saldo.
        </EmptyState>
      ) : (
        <div className="wallet-list">
          {visibleWallets.map((wallet) => (
            <Card className={`wallet-card${wallet.archived ? ' is-archived' : ''}`} key={wallet.id}>
              <div className="wallet-card__top">
                <div>
                  <p className="wallet-card__type">{walletTypes.find(({ value }) => value === wallet.type)?.label}</p>
                  <h3>{wallet.name}</h3>
                </div>
                {wallet.archived && <span className="archive-badge">Diarsipkan</span>}
              </div>
              <p className="wallet-card__balance">
                {balanceResult.error
                  ? 'Saldo tidak tersedia'
                  : formatRupiah(balanceResult.balances.get(wallet.id) ?? wallet.initialBalance)}
              </p>
              <p className="wallet-card__opening">Saldo awal {formatRupiah(wallet.initialBalance)}</p>
              <div className="wallet-card__actions">
                <Button
                  variant="secondary"
                  type="button"
                  className="button--compact"
                  onClick={() => startEdit(wallet)}
                >
                  Ubah
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  className="button--compact"
                  onClick={() => void toggleArchived(wallet)}
                >
                  {wallet.archived ? 'Pulihkan' : 'Arsipkan'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
