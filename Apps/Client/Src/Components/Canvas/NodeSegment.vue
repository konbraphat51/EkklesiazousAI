<!-- One utterance on the timeline as a compact speaker-lane bar; the full text shows on hover,
     with the private "?" help button. -->
<template>
  <div
    class="segment"
    :style="{ '--speaker-color': color }"
    :title="`${speakerLabel}: ${data.segment.text}`"
  >
    <span class="segment__label">{{ data.segment.text }}</span>
    <span
      v-if="confusionCount > 0"
      class="segment__confusion"
      :title="t('transcript.confusionTitle')"
    >
      ?×{{ confusionCount }}
    </span>
    <div class="segment__popover">
      <strong>{{ speakerLabel }}</strong> {{ data.segment.text }}
      <button type="button" class="button button--small nodrag" @click.stop="askClarification">
        ? {{ t('transcript.explain') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TranscriptSegment } from '@ekklesiazous/shared'
import { useClarification } from '../../Composables/UseClarification'
import { useRoomSession } from '../../Services/RoomSession'
import { PALETTE } from '../../Services/ParticipantIdentity'

export default defineComponent({
  name: 'NodeSegment',
  props: {
    /** Node payload from the layout. */
    data: { type: Object as PropType<{ segment: TranscriptSegment }>, required: true },
  },
  setup(props) {
    const { t } = useI18n()
    const session = useRoomSession()
    const { askAboutSegments } = useClarification()
    const speaker = computed(() =>
      session.state.speakers.value.find(
        (candidate) => candidate.id === props.data.segment.speakerId,
      ),
    )
    return {
      t,
      speakerLabel: computed(() => speaker.value?.label ?? '…'),
      color: computed(() => PALETTE[(speaker.value?.colorIndex ?? 0) % PALETTE.length]),
      confusionCount: computed(() =>
        session.ux.value.confusionMarks === 'visible'
          ? (session.state.confusion.value.get(props.data.segment.id) ?? 0)
          : 0,
      ),
      askClarification: () => askAboutSegments([props.data.segment.id], null),
    }
  },
})
</script>

<style scoped>
.segment {
  position: relative;
  height: 24px;
  padding: 0 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--speaker-color) 18%, white);
  border-left: 3px solid var(--speaker-color);
  font-size: 11px;
  line-height: 24px;
}

.segment__label {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--color-text);
}

.segment__confusion {
  position: absolute;
  top: -14px;
  right: 0;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-warning);
}

.segment__popover {
  display: none;
  position: absolute;
  top: 28px;
  left: 0;
  width: 280px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--speaker-color);
  border-radius: var(--radius-small);
  background: var(--color-surface);
  box-shadow: var(--shadow-raised);
  font-size: 12px;
  line-height: 1.45;
  z-index: 10;
}

.segment__popover strong {
  color: var(--speaker-color);
}

.segment__popover .button {
  margin-top: 6px;
}

.segment:hover .segment__popover {
  display: block;
}
</style>
