import { useRef, type ReactNode } from 'react'

type Props = {
  accept?: string
  disabled?: boolean
  onFile: (file: File) => void
  children: ReactNode
  className?: string
}

/** A button that opens the file picker. */
export function OpenFileButton({ accept, disabled = false, onFile, children, className }: Props) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => input.current?.click()} className={className}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Reset, so that choosing the same file again still fires a change.
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
    </>
  )
}
