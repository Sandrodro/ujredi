export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-sm text-slate-500 hover:text-slate-800">
      ← Home
    </button>
  )
}
