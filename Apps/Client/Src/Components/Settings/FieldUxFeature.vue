<!-- One UX feature selector showing the hypothesis behind the chosen option. -->
<template>
  <label class="feature">
    <span class="feature__name">{{ t(`uxFeature.${featureId}.name`) }}</span>
    <select class="input" :value="value" :disabled="isDisabled" @change="change">
      <option v-for="option in options" :key="option" :value="option">
        {{ t(`uxFeature.${featureId}.options.${option}`) }}
      </option>
    </select>
    <span class="feature__hint">{{ t(`uxFeature.${featureId}.hint.${value}`) }}</span>
  </label>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { UX_FEATURES, type UxFeatureId } from '@ekklesiazous/shared'

export default defineComponent({
  name: 'FieldUxFeature',
  props: {
    /** Feature to edit. */
    featureId: { type: String as PropType<UxFeatureId>, required: true },
    /** Current option. */
    value: { type: String, required: true },
    /** Disables editing (locked rooms). */
    isDisabled: { type: Boolean, default: false },
  },
  emits: {
    /** New option chosen. */
    change: (_value: string) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n()
    return {
      t,
      options: computed(() => UX_FEATURES[props.featureId].options as readonly string[]),
      change: (event: Event) => emit('change', (event.target as HTMLSelectElement).value),
    }
  },
})
</script>

<style scoped>
.feature {
  display: grid;
  grid-template-columns: 170px 1fr;
  gap: 2px 10px;
  align-items: center;
}

.feature__name {
  font-size: 13px;
  font-weight: 500;
}

.feature__hint {
  grid-column: 2;
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
