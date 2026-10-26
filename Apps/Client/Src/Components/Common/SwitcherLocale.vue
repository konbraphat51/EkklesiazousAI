<!-- Toggle between English and Japanese UI. -->
<template>
  <div class="switcher" role="group" :aria-label="t('common.language')">
    <button
      v-for="option in options"
      :key="option"
      type="button"
      class="switcher__option"
      :class="{ 'switcher__option--active': option === locale }"
      @click="select(option)"
    >
      {{ option === 'en' ? 'EN' : '日本語' }}
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocaleUi, type LocaleUi } from '../../Locales/I18n'

export default defineComponent({
  name: 'SwitcherLocale',
  setup() {
    const { t, locale } = useI18n()
    const options: LocaleUi[] = ['en', 'ja']
    return { t, locale, options, select: (option: LocaleUi) => setLocaleUi(option) }
  },
})
</script>

<style scoped>
.switcher {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
  overflow: hidden;
}

.switcher__option {
  padding: 3px 10px;
  border: none;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 12px;
}

.switcher__option--active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: 600;
}
</style>
