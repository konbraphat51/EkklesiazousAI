// Safe access to localStorage (it can be unavailable in private windows or embedded views).

/**
 * Reads a JSON value.
 *
 * @param key - Storage key.
 * @param fallback - Value when missing or unreadable.
 */
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/**
 * Writes a JSON value; failures are ignored.
 *
 * @param key - Storage key.
 * @param value - Value to store.
 */
export function writeStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable: preferences simply are not remembered
  }
}
