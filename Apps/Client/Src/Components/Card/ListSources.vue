<!-- Clickable list of the references behind an insight. -->
<template>
  <ul class="sources">
    <li v-for="source in sources" :key="source.url" class="sources__item">
      <span class="sources__category">{{ t(`sourceCategory.${source.category}`) }}</span>
      <a
        :href="source.url"
        target="_blank"
        rel="noopener noreferrer"
        class="sources__title"
        @click="$emit('open', source.url)"
        >{{ source.title }}</a
      >
      <span class="sources__meta"
        >{{ source.publisher }}{{ source.year ? ` · ${source.year}` : '' }}</span
      >
    </li>
  </ul>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { InsightSource } from '@ekklesiazous/shared'

export default defineComponent({
  name: 'ListSources',
  props: {
    /** References to list. */
    sources: { type: Array as PropType<InsightSource[]>, required: true },
  },
  emits: {
    /** Fired with the URL when a source is opened. */
    open: (_url: string) => true,
  },
  setup() {
    const { t } = useI18n()
    return { t }
  },
})
</script>

<style scoped>
.sources {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sources__item {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 6px;
  font-size: 12px;
}

.sources__category {
  grid-row: span 2;
  align-self: start;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-size: 10px;
  line-height: 18px;
}

.sources__title {
  color: var(--color-accent);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.sources__title:hover {
  text-decoration: underline;
}

.sources__meta {
  color: var(--color-text-muted);
  font-size: 11px;
}
</style>
