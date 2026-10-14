export type FillErrorKind = 'unfillable' | 'timeout' | 'unavailable' | 'invalid' | 'server'

export class FillError extends Error {
  kind: FillErrorKind

  constructor(kind: FillErrorKind) {
    super(kind)
    this.kind = kind
  }
}

export type Candidate = { word: string; source: string }

const MESSAGES: Record<FillErrorKind, string> = {
  unfillable: 'No fill exists with these letters. Remove some letters or try another grid.',
  timeout: 'The filler hit the time limit. Try a looser grid, or type a few words first.',
  unavailable: 'Filling is off: ingrid_core is not installed on the creator server.',
  invalid: 'Fill works with Georgian letters only. Remove the other characters and try again.',
  server: 'The creator server did not answer. Is `make dev-creator-server` running?',
}

const LONG_WORDS_HINT =
  ' Grids with words longer than 9 letters rarely fill with the current word list. Try a loose grid.'

/** `longWords` is true when the grid has a word longer than the loose tier allows. */
export function fillErrorMessage(error: unknown, longWords = false): string {
  if (!(error instanceof FillError)) return MESSAGES.server
  return error.kind === 'unfillable' && longWords ? MESSAGES.unfillable + LONG_WORDS_HINT : MESSAGES[error.kind]
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new FillError('server')
  }
  if (response.status === 422) throw new FillError('unfillable')
  if (response.status === 504) throw new FillError('timeout')
  if (response.status === 503) throw new FillError('unavailable')
  if (response.status === 400) throw new FillError('invalid')
  if (!response.ok) throw new FillError('server')
  return response
}

/** Fills the `.` cells of a 13x13 grid. Letters already in the grid stay. */
export async function fillGrid(rows: string[], signal?: AbortSignal): Promise<string[]> {
  const response = await request('/api/fill', {
    signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  return (await response.json()).rows
}

/** Words that match a pattern such as `მგ...`, best source first. */
export async function fetchCandidates(pattern: string): Promise<Candidate[]> {
  const response = await request(`/api/candidates?pattern=${encodeURIComponent(pattern)}`)
  return (await response.json()).words
}
