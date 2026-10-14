type Props = {
  title: string
  author: string
  onTitleChange: (title: string) => void
  onAuthorChange: (author: string) => void
}

const INPUT = 'min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm'

export function PuzzleDetails({ title, author, onTitleChange, onAuthorChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <label className="flex flex-1 items-center gap-2 text-sm">
        <span className="font-medium">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Required to save"
          className={INPUT}
        />
      </label>
      <label className="flex flex-1 items-center gap-2 text-sm">
        <span className="font-medium">Author</span>
        <input
          type="text"
          value={author}
          onChange={(e) => onAuthorChange(e.target.value)}
          placeholder="Optional"
          className={INPUT}
        />
      </label>
    </div>
  )
}
