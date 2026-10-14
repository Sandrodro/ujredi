import type { ReactNode } from 'react'

type Props = {
  busy?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

/** A button that shows "Filling…" while the filler runs. */
export function FillButton({ busy = false, disabled = false, onClick, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="rounded bg-amber-500 px-3 py-1 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? 'Filling…' : children}
    </button>
  )
}
