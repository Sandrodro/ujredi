const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// Whitespace, control characters and invisible formatting characters.
const INVISIBLE = /^[\s\p{Cc}\p{Cf}]+$/u

/**
 * Splits text into graphemes, what a person sees as one character. A family
 * emoji is one grapheme, although it has many code points. Spaces and invisible
 * characters are dropped.
 */
export function graphemes(text: string): string[] {
  return [...segmenter.segment(text)].map(({ segment }) => segment).filter((g) => !INVISIBLE.test(g))
}
