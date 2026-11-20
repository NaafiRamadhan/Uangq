import { formatRupiah } from '../../lib/money'
import type { BudgetProgressStatus } from '../../lib/budget'

const statusLabels: Record<BudgetProgressStatus, string> = {
  normal: 'Di bawah batas',
  near: 'Mendekati batas',
  over: 'Melewati batas',
}

export function BudgetProgress({
  label,
  spent,
  limit,
  percentage,
  status,
}: {
  label: string
  spent: number
  limit: number
  percentage: number
  status: BudgetProgressStatus
}) {
  const visualPercentage = Math.min(100, Math.max(0, percentage))

  return (
    <div className={`budget-progress budget-progress--${status}`}>
      <div className="budget-progress__heading">
        <h3>{label}</h3>
        <span className="budget-progress__status">{statusLabels[status]}</span>
      </div>
      <div
        className="budget-progress__track"
        role="progressbar"
        aria-label={`Progres ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={visualPercentage}
        aria-valuetext={`${percentage}% dari batas`}
      >
        <span className="budget-progress__fill" style={{ width: `${visualPercentage}%` }} />
      </div>
      <p className="budget-progress__amounts">
        <span>{formatRupiah(spent)} terpakai</span>
        <span>dari {formatRupiah(limit)}</span>
      </p>
    </div>
  )
}
