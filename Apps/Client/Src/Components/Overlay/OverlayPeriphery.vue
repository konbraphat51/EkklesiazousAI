<!-- Calm periphery: insights in quiet edge trays by kind; only urgent, recent ones reach the centre. -->
<template>
  <div class="periphery">
    <aside class="periphery__tray periphery__tray--left">
      <h3>{{ t('periphery.catchUp') }}</h3>
      <CardInsight v-for="insight in trays.left" :key="insight.id" :insight="insight" />
    </aside>
    <aside class="periphery__tray periphery__tray--right">
      <h3>{{ t('periphery.research') }}</h3>
      <CardInsight v-for="insight in trays.right" :key="insight.id" :insight="insight" />
    </aside>
    <aside class="periphery__tray periphery__tray--bottom">
      <h3>{{ t('periphery.challenges') }}</h3>
      <div class="periphery__row">
        <CardInsight v-for="insight in trays.bottom" :key="insight.id" :insight="insight" />
      </div>
    </aside>
    <div v-if="urgent" class="periphery__centre">
      <CardInsight :key="urgent.id" :insight="urgent" :is-pulsing="true" />
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Insight } from '@ekklesiazous/shared'
import { useNow } from '../../Composables/UseNow'
import { useRoomSession } from '../../Services/RoomSession'
import CardInsight from '../Card/CardInsight.vue'

const URGENT_THRESHOLD = 0.85
const URGENT_WINDOW_MS = 90_000
const TRAY_LIMIT = 6

export default defineComponent({
  name: 'OverlayPeriphery',
  components: { CardInsight },
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const now = useNow(5000)
    const visible = computed(() =>
      session.state.insights.value
        .filter((insight) => insight.status !== 'dismissed')
        .sort((a, b) => b.createdAt - a.createdAt),
    )
    const urgent = computed<Insight | null>(
      () =>
        visible.value.find(
          (insight) =>
            insight.urgency >= URGENT_THRESHOLD &&
            now.value - (insight.timings.releasedAt ?? insight.createdAt) < URGENT_WINDOW_MS,
        ) ?? null,
    )
    const trays = computed(() => {
      const rest = visible.value.filter((insight) => insight.id !== urgent.value?.id)
      const take = (kinds: Insight['kind'][]): Insight[] =>
        rest.filter((insight) => kinds.includes(insight.kind)).slice(0, TRAY_LIMIT)
      return {
        left: take(['catchUp']),
        right: take(['priorArt', 'answer']),
        bottom: take(['critique', 'factCheck']),
      }
    })
    return { t, trays, urgent }
  },
})
</script>

<style scoped>
.periphery {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

.periphery__tray {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  overflow-y: auto;
  pointer-events: auto;
  opacity: 0.88;
  transition: opacity 0.2s;
}

.periphery__tray:hover {
  opacity: 1;
}

.periphery__tray h3 {
  margin: 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.periphery__tray--left,
.periphery__tray--right {
  top: 8px;
  bottom: 190px;
  width: 270px;
}

.periphery__tray--left {
  left: 8px;
}

.periphery__tray--right {
  right: 8px;
}

.periphery__tray--bottom {
  left: 290px;
  right: 290px;
  bottom: 8px;
  max-height: 180px;
}

.periphery__row {
  display: flex;
  gap: 8px;
}

.periphery__row > * {
  flex: 0 0 280px;
}

.periphery__centre {
  position: absolute;
  top: 24px;
  left: 50%;
  width: 420px;
  transform: translateX(-50%);
  pointer-events: auto;
}
</style>
