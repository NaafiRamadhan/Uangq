import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
} from 'react'
import type { ReactNode } from 'react'
import {
  formatMoneyInput,
  getMoneyInputCaretPosition,
  parseMoneyInput,
  type MoneyInputValue,
} from '../lib/money'
import type { EffectiveTheme, ThemeMode } from '../lib/theme'

type IconName = 'home' | 'wallet' | 'transactions' | 'budget' | 'settings' | 'sun' | 'moon'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2" /><path d="M7 5V3h11" /></>,
    transactions: <><path d="M7 7h13l-3-3M17 17H4l3 3" /><path d="M20 7a7 7 0 0 1-7 7M4 17a7 7 0 0 1 7-7" /></>,
    budget: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
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

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type' | 'inputMode' | 'value' | 'onChange'
> & {
  label: string
  id?: string
  value: MoneyInputValue
  onChange: (value: MoneyInputValue) => void
}

export function MoneyInput({
  label,
  id,
  value,
  onChange,
  className = '',
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: MoneyInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-money-error`
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCaretDigits = useRef<number | null>(null)
  const [error, setError] = useState('')
  const [renderVersion, setRenderVersion] = useState(0)
  const formattedValue = formatMoneyInput(value)

  useLayoutEffect(() => {
    const input = inputRef.current
    const digitCount = pendingCaretDigits.current
    if (!input || digitCount === null) return

    const caret = getMoneyInputCaretPosition(input.value, digitCount)
    input.setSelectionRange(caret, caret)
    pendingCaretDigits.current = null
  }, [renderVersion, value])

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const rawValue = input.value
    const selectionStart = input.selectionStart ?? rawValue.length
    const digitsBeforeCaret = rawValue.slice(0, selectionStart).replace(/\D/g, '').length
    const parsedValue = parseMoneyInput(rawValue)

    pendingCaretDigits.current = digitsBeforeCaret
    if (parsedValue === null) {
      setError('Nominal melebihi batas bilangan bulat rupiah yang aman.')
      input.value = formattedValue
    } else {
      setError('')
      input.value = formatMoneyInput(parsedValue)
      onChange(parsedValue)
    }
    setRenderVersion((version) => version + 1)
  }

  const mergedDescribedBy = [describedBy, error ? errorId : ''].filter(Boolean).join(' ') || undefined

  return (
    <label className="input-field" htmlFor={inputId}>
      <span>{label}</span>
      <span className="money-input">
        <span className="money-input__prefix" aria-hidden="true">Rp</span>
        <input
          {...props}
          ref={inputRef}
          id={inputId}
          className={`input-control money-input__control ${className}`.trim()}
          type="text"
          inputMode="numeric"
          value={formattedValue}
          onChange={handleChange}
          aria-describedby={mergedDescribedBy}
          aria-invalid={Boolean(error) || ariaInvalid}
          autoComplete={props.autoComplete ?? 'off'}
        />
      </span>
      {error && <span className="money-input__error" id={errorId} role="alert">{error}</span>}
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

export function PageHeader({
  title,
  themeMode,
  effectiveTheme,
  onCycleTheme,
}: {
  title: string
  themeMode: ThemeMode
  effectiveTheme: EffectiveTheme
  onCycleTheme: () => void
}) {
  const modeLabels: Record<ThemeMode, string> = {
    system: `Sistem (${effectiveTheme === 'dark' ? 'Gelap' : 'Terang'})`,
    light: 'Terang',
    dark: 'Gelap',
  }
  const nextModeLabels: Record<ThemeMode, string> = {
    system: 'Terang',
    light: 'Gelap',
    dark: 'Sistem',
  }
  const ariaLabel = `Tema saat ini: ${modeLabels[themeMode]}. Ketuk untuk beralih ke ${nextModeLabels[themeMode]}.`

  return (
    <header className="page-header">
      <div className="page-header__title">
        <p className="page-header__brand">UANGQ</p>
        <h1>{title}</h1>
      </div>
      <Button
        variant="secondary"
        className="theme-toggle"
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={onCycleTheme}
      >
        <Icon name={effectiveTheme === 'dark' ? 'moon' : 'sun'} />
      </Button>
    </header>
  )
}
