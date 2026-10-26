<!-- Canvas frame of one topic island. -->
<template>
  <div class="frame" :class="{ 'frame--idle': data.isIdle }">
    <header class="frame__header">
      <span class="frame__label">{{ data.label ?? t('canvas.otherTopic') }}</span>
      <span class="frame__count">{{ data.count }}</span>
    </header>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'NodeTopicFrame',
  props: {
    /** Node payload from the layout. */
    data: {
      type: Object as PropType<{ label: string | null; count: number; isIdle: boolean }>,
      required: true,
    },
  },
  setup() {
    const { t } = useI18n()
    return { t }
  },
})
</script>

<style scoped>
.frame {
  width: 100%;
  height: 100%;
  border: 2px dashed #c9d2ea;
  border-radius: var(--radius-large);
  background: rgba(232, 236, 253, 0.35);
  transition: opacity 0.6s;
}

.frame--idle {
  opacity: 0.5;
  filter: grayscale(0.7);
}

.frame__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
}

.frame__label {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-accent);
}

.frame__count {
  padding: 0 8px;
  border-radius: 999px;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-size: 12px;
}
</style>
