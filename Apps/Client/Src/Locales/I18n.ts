// UI localization: English by default, Japanese available; the choice is remembered per browser.
import { createI18n } from 'vue-i18n'
import En from './En.json'
import Ja from './Ja.json'
import { readStorage, writeStorage } from '../Services/StorageLocal'

/** Supported UI locales. */
export type LocaleUi = 'en' | 'ja'

const STORAGE_KEY = 'ekklesiazous.locale'

/** Global i18n instance. */
export const i18n = createI18n({
  legacy: false,
  locale: readStorage<LocaleUi>(STORAGE_KEY, 'en'),
  fallbackLocale: 'en',
  messages: { en: En, ja: Ja },
})

/**
 * Switches and remembers the UI locale.
 *
 * @param locale - New locale.
 */
export function setLocaleUi(locale: LocaleUi): void {
  i18n.global.locale.value = locale
  writeStorage(STORAGE_KEY, locale)
  document.documentElement.lang = locale
}

/** Reads the current UI locale. */
export function getLocaleUi(): LocaleUi {
  return i18n.global.locale.value as LocaleUi
}
