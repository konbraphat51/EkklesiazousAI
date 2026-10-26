<!-- Colored label of an insight kind, with an origin hint (asked by, anonymous, several asked). -->
<template>
  <span class="badge" :style="{ '--kind-color': `var(--kind-${kind})` }">
    <span class="badge__dot" aria-hidden="true" />
    {{ t(`kind.${kind}`) }}
    <span v-if="originLabel" class="badge__origin">· {{ originLabel }}</span>
  </span>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { InsightKind, InsightOrigin } from '@ekklesiazous/shared'

export default defineComponent({
  name: 'BadgeKind',
  props: {
    /** Insight kind. */
    kind: { type: String as PropType<InsightKind>, required: true },
    /** Why the insight exists. */
    origin: { type: String as PropType<InsightOrigin>, default: 'proactive' },
    /** Requester name for explicit commands. */
    requesterName: { type: String as PropType<string | null>, default: null },
  },
  setup(props) {
    const { t } = useI18n()
    const originLabel = computed(() => {
      if (props.origin === 'command') {
        return props.requesterName
          ? t('origin.commandBy', { name: props.requesterName })
          : t('origin.command')
      }
      if (props.origin === 'clarification') return t('origin.clarification')
      if (props.origin === 'proxyDissent') return t('origin.proxyDissent')
      return ''
    })
    return { t, originLabel }
  },
})
</script>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--kind-color);
}

.badge__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--kind-color);
}

.badge__origin {
  font-weight: 500;
  text-transform: none;
  color: var(--color-text-muted);
}
</style>
