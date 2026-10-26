<!-- Anonymous participation-equity meter: share of talk time per speaker, without names. -->
<template>
  <div class="balance" :title="t('balance.title')">
    <div class="balance__bar">
      <span
        v-for="share in shares"
        :key="share.speakerId"
        class="balance__share"
        :style="{ width: `${share.ratio * 100}%`, background: share.color }"
      />
    </div>
    <span class="balance__label">{{ t(isBalanced ? 'balance.balanced' : 'balance.uneven') }}</span>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { PALETTE } from '../../Services/ParticipantIdentity'
import { useRoomSession } from '../../Services/RoomSession'

const BALANCED_EVENNESS = 0.8

export default defineComponent({
  name: 'MeterSpeakingBalance',
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const shares = computed(() => {
      const totals = new Map<string, number>()
      for (const segment of session.state.segments.value) {
        const duration = Math.max(0, segment.endMs - segment.startMs)
        totals.set(segment.speakerId, (totals.get(segment.speakerId) ?? 0) + duration)
      }
      const sum = [...totals.values()].reduce((total, value) => total + value, 0) || 1
      const colorOf = new Map(
        session.state.speakers.value.map((speaker) => [speaker.id, speaker.colorIndex]),
      )
      return [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([speakerId, value]) => ({
          speakerId,
          ratio: value / sum,
          color: PALETTE[(colorOf.get(speakerId) ?? 0) % PALETTE.length],
        }))
    })
    // Pielou evenness: normalized entropy of talk-time shares
    const isBalanced = computed(() => {
      if (shares.value.length < 2) return true
      const entropy = -shares.value.reduce(
        (total, share) => total + share.ratio * Math.log(share.ratio || 1),
        0,
      )
      return entropy / Math.log(shares.value.length) >= BALANCED_EVENNESS
    })
    return { t, shares, isBalanced }
  },
})
</script>

<style scoped>
.balance {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--color-border);
}

.balance__bar {
  display: flex;
  flex: 1;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--color-surface-muted);
}

.balance__share {
  height: 100%;
}

.balance__label {
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
