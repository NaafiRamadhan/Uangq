import { useEffect, useState } from 'react'
import { db, type Wallet } from '../../db/schema'
import { Button, Card } from '../../components/ui'

export function SettingsPage({
  defaultWalletId,
  onDefaultWalletChange,
  message,
}: {
  defaultWalletId: string
  onDefaultWalletChange: (walletId: string) => void
  message: string
}) {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void db.wallets.toArray()
      .then((items) => {
        if (active) setWallets(items.filter((wallet) => !wallet.archived))
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Dompet gagal dimuat.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <Card className="settings-card">
      <p className="section-kicker">PREFERENSI</p>
      <h2>Dompet default</h2>
      <p className="backup-note">
        Dompet ini digunakan pada input cepat jika teks tidak menyebut nama dompet. Hasilnya tetap bisa diubah.
      </p>
      <label className="input-field settings-default-wallet">
        <span>Pilih dompet default</span>
        <select
          className="input-control"
          value={wallets.some(({ id }) => id === defaultWalletId) ? defaultWalletId : ''}
          disabled={loading || wallets.length === 0}
          onChange={(event) => onDefaultWalletChange(event.target.value)}
        >
          <option value="">Belum dipilih</option>
          {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
        </select>
      </label>
      {loading && <p className="backup-note" role="status">Memuat dompet…</p>}
      {!loading && wallets.length === 0 && (
        <p className="backup-note">Buat dompet aktif terlebih dahulu untuk memilih dompet default.</p>
      )}
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {message && <p className="status-message" role="status">{message}</p>}
      {!loading && wallets.length > 0 && !defaultWalletId && (
        <p className="backup-note">Tanpa pilihan ini, dompet perlu dipilih pada setiap draf sebelum disimpan.</p>
      )}
      {defaultWalletId && !wallets.some(({ id }) => id === defaultWalletId) && (
        <Button
          variant="secondary"
          className="settings-reset"
          type="button"
          onClick={() => onDefaultWalletChange('')}
        >
          Hapus pilihan dompet default
        </Button>
      )}
    </Card>
  )
}
