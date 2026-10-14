import { useSyncExternalStore } from 'react'

// This state lives outside React, so it survives a remount of the editor or the page.
const running = new Map<string, AbortController>()
const messages = new Map<string, string>()
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((listener) => listener())

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Marks a fill as running and clears the old message. Returns the signal that `stopFill` aborts. */
export function startFill(id: string): AbortSignal {
  const controller = new AbortController()
  running.set(id, controller)
  messages.delete(id)
  notify()
  return controller.signal
}

export function endFill(id: string) {
  running.delete(id)
  notify()
}

export function stopFill(id: string) {
  running.get(id)?.abort()
}

export function setFillMessage(id: string, message: string | null) {
  if (message === null) messages.delete(id)
  else messages.set(id, message)
  notify()
}

export const isFilling = (id: string) => running.has(id)
export const fillMessage = (id: string) => messages.get(id) ?? null

/** True while a fill for `id` runs, also when it started before this component mounted. */
export const useFilling = (id: string) => useSyncExternalStore(subscribe, () => isFilling(id))

/** The last fill or candidate error for `id`, also when it came after a remount. */
export const useFillMessage = (id: string) => useSyncExternalStore(subscribe, () => fillMessage(id))
