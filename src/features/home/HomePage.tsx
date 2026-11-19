import { useEffect, useState } from 'react'
import { db, seedDatabase, type Category, type Wallet } from '../../db/schema'
import { Button, Card } from '../../components/ui'
import { QuickEntry } from '../transactions/QuickEntry'

export function HomePage({
  defaultWalletId,
  onOpenWallets,
}: {
  defaultWalletId: string
  onOpenWallets: () => void
}) {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void seedDatabase()
      .then(async () => Promise.all([db.wallets.toArray(), db.categories.toArray()]))
      .then(([nextWallets, nextCategories]) => {
        if (!active) return
        setWallets(nextWallets)
        setCategories(nextCategories)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Data input cepat gagal dimuat.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="feature-page">
      {loading ? (
        <p className="feature-description" role="status">Memuat data…</p>
      ) : (
        <>
          {error && <p className="form-message form-message--error" role="alert">{error}</p>}
          <QuickEntry
            wallets={wallets}
            categories={categories}
            defaultWalletId={defaultWalletId}
          />
          {wallets.every((wallet) => wallet.archived) && (
            <Card className="home-wallet-prompt">
              <h2>Mulai dengan dompet</h2>
              <p className="backup-note">Tambahkan dompet agar draf transaksi bisa disimpan.</p>
              <Button variant="secondary" type="button" onClick={onOpenWallets}>Buat dompet</Button>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
