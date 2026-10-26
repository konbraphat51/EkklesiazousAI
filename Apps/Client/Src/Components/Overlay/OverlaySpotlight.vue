<!-- Shared spotlight: one card promoted to a centre frame for everyone (joint attention). -->
<template>
  <Transition name="spotlight">
    <div v-if="insight" class="spotlight" role="dialog" :aria-label="t('spotlight.label')">
      <div class="spotlight__frame">
        <header class="spotlight__header">
          <span>🔦 {{ t('spotlight.label') }}</span>
          <button type="button" class="button button--small" @click="close">
            {{ t('spotlight.close') }}
          </button>
        </header>
        <CardInsight :key="insight.id" :insight="insight" :is-expanded-initially="true" />
      </div>
    </div>
  </Transition>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoomSession } from '../../Services/RoomSession'
import CardInsight from '../Card/CardInsight.vue'

export default defineComponent({
  name: 'OverlaySpotlight',
  components: { CardInsight },
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const insight = computed(() => {
      const id = session.state.meta.value.spotlightInsightId
      if (!id || session.ux.value.spotlight === 'off') return null
      return session.state.insights.value.find((candidate) => candidate.id === id) ?? null
    })
    const close = (): void =>
      session.board.patchMeta({ spotlightInsightId: null, spotlightAt: null })
    return { t, insight, close }
  },
})
</script>

<style scoped>
.spotlight {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(29, 33, 41, 0.28);
  z-index: 20;
}

.spotlight__frame {
  width: min(560px, 90%);
  padding: 14px;
  border-radius: var(--radius-large);
  background: var(--color-surface);
  box-shadow: var(--shadow-raised);
}

.spotlight__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.spotlight-enter-active,
.spotlight-leave-active {
  transition: opacity 0.25s;
}

.spotlight-enter-from,
.spotlight-leave-to {
  opacity: 0;
}
</style>
