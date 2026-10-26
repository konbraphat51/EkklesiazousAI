<!-- One finalized utterance with private help: "?" for the line, or highlight a phrase to explain it. -->
<template>
  <li class="line" :style="{ '--speaker-color': color }" @mouseup="captureSelection">
    <header class="line__header">
      <button
        type="button"
        class="line__speaker"
        :title="t('transcript.rename')"
        @click="$emit('rename', segment.speakerId)"
      >
        {{ speakerLabel }}
      </button>
      <span class="line__time">{{ time }}</span>
      <span
        v-if="confusionCount > 0"
        class="line__confusion"
        :title="t('transcript.confusionTitle')"
      >
        ?×{{ confusionCount }}
      </span>
      <button type="button" class="line__help" :title="t('transcript.explain')" @click="askLine">
        ?
      </button>
    </header>
    <p class="line__text">{{ segment.text }}</p>
    <button
      v-if="selection"
      type="button"
      class="line__explain button button--small button--primary"
      @click="askSelection"
    >
      {{ t('transcript.explainSelection', { text: selectionShort }) }}
    </button>
  </li>
</template>

<script lang="ts">
import { computed, defineComponent, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TranscriptSegment } from '@ekklesiazous/shared'
import { useClarification } from '../../Composables/UseClarification'

export default defineComponent({
  name: 'LineTranscript',
  props: {
    /** The utterance. */
    segment: { type: Object as PropType<TranscriptSegment>, required: true },
    /** Speaker display name. */
    speakerLabel: { type: String, required: true },
    /** Speaker accent color. */
    color: { type: String, required: true },
    /** Anonymous clarification count (0 hides the mark). */
    confusionCount: { type: Number, default: 0 },
  },
  emits: {
    /** Rename the speaker of this line. */
    rename: (_speakerId: string) => true,
  },
  setup(props) {
    const { t } = useI18n()
    const { askAboutSegments } = useClarification()
    const selection = ref('')
    const time = computed(() => {
      const seconds = Math.max(0, Math.floor(props.segment.startMs / 1000))
      return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    })
    const captureSelection = (): void => {
      selection.value = (window.getSelection()?.toString() ?? '').trim().slice(0, 200)
    }
    const askLine = (): void => askAboutSegments([props.segment.id], null)
    const askSelection = (): void => {
      askAboutSegments([props.segment.id], selection.value)
      selection.value = ''
      window.getSelection()?.removeAllRanges()
    }
    return {
      t,
      time,
      selection,
      selectionShort: computed(() =>
        selection.value.length > 24 ? `${selection.value.slice(0, 24)}…` : selection.value,
      ),
      captureSelection,
      askLine,
      askSelection,
    }
  },
})
</script>

<style scoped>
.line {
  position: relative;
  padding: 6px 10px 6px 12px;
  border-left: 3px solid var(--speaker-color);
}

.line:hover {
  background: var(--color-surface-muted);
}

.line__header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.line__speaker {
  padding: 0;
  border: none;
  background: none;
  font-weight: 600;
  color: var(--speaker-color);
}

.line__time {
  color: var(--color-text-muted);
  font-size: 11px;
}

.line__confusion {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-warning);
}

.line__help {
  margin-left: auto;
  width: 20px;
  height: 20px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 11px;
  opacity: 0;
}

.line:hover .line__help,
.line__help:focus {
  opacity: 1;
}

.line__text {
  margin: 2px 0 0;
  font-size: 13px;
  user-select: text;
}

.line__explain {
  margin-top: 4px;
}
</style>
