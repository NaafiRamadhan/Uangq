import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes } from 'react'
import type { ReactNode } from 'react'

type IconName = 'home' | 'wallet' | 'transactions' | 'budget' | 'settings'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2" /><path d="M7 5V3h11" /></>,
    transactions: <><path d="M7 7h13l-3-3M17 17H4l3 3" /><path d="M20 7a7 7 0 0 1-7 7M4 17a7 7 0 0 1 7-7" /></>,
    budget: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" /></>,
  }

  return (
    <svg aria-hidden="true" className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`.trim()} {...props} />
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`button button--${variant} ${className}`.trim()} {...props} />
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

export function Input({ label, id, className = '', ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label className="input-field" htmlFor={inputId}>
      <span>{label}</span>
      <input id={inputId} className={`input-control ${className}`.trim()} {...props} />
    </label>
  )
}

type NavigationItem = {
  label: string
  icon: IconName
  current: boolean
  onClick: () => void
}

export function BottomNav({ items }: { items: NavigationItem[] }) {
  return (
    <nav className="bottom-nav" aria-label="Navigasi utama">
      {items.map((item) => (
        <button
          type="button"
          key={item.label}
          className={`bottom-nav__item${item.current ? ' is-active' : ''}`}
          onClick={item.onClick}
          aria-current={item.current ? 'page' : undefined}
        >
          <span className="bottom-nav__icon"><Icon name={item.icon} /></span>
          <span className="bottom-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <Card className="empty-state">
      <span className="empty-state__mark" aria-hidden="true"><Icon name="budget" /></span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </Card>
  )
}

export function PageHeader({ title }: { title: string }) {
  return (
    <header className="page-header">
      <p className="page-header__brand">UANGQ</p>
      <h1>{title}</h1>
    </header>
  )
}
