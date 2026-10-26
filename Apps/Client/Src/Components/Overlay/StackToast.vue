<!-- Toast notifications for newly delivered insights (the `toast` attention cue). -->
<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <button
        v-for="toast in toasts"
        :key="toast.id"
        type="button"
        class="toasts__item"
        :style="{ '--kind-color': `var(--kind-${toast.kind})` }"
        @click="open(toast.id)"
      >
        <span class="toasts__kind">{{ t(`kind.${toast.kind}`) }}</span>
        <span class="toasts__title">{{ toast.title }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { InsightKind } from '@ekklesiazous/shared'
import { useRoomSession } from '../../Services/RoomSession'

const TOAST_MS = 7000
const TOAST_LIMIT = 3

export default defineComponent({
  name: 'StackToast',
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const toasts = ref<Array<{ id: string; kind: InsightKind; title: string }>>([])
    const openedAt = Date.now()
    let known = new Set(session.state.insights.value.map((insight) => insight.id))

    watch(session.state.insights, (insights) => {
      const fresh = insights.filter(
        (insight) =>
          !known.has(insight.id) && (insight.timings.releasedAt ?? insight.createdAt) >= openedAt,
      )
      known = new Set(insights.map((insight) => insight.id))
      if (session.ux.value.attentionCue !== 'toast') return
      for (const insight of fresh) {
        toasts.value = [
          { id: insight.id, kind: insight.kind, title: insight.title },
          ...toasts.value,
        ].slice(0, TOAST_LIMIT)
        setTimeout(() => {
          toasts.value = toasts.value.filter((toast) => toast.id !== insight.id)
        }, TOAST_MS)
      }
    })

    const open = (id: string): void => {
      session.focusRequest.value = { itemId: id, at: Date.now() }
      toasts.value = toasts.value.filter((toast) => toast.id !== id)
    }
    return { t, toasts, open }
  },
})
</script>

<style scoped>
.toasts {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 15;
}

.toasts__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 280px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--kind-color);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-raised);
  text-align: left;
}

.toasts__kind {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--kind-color);
}

.toasts__title {
  font-size: 13px;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
