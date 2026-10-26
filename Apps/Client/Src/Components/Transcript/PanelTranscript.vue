<!-- Live transcript: finalized utterances plus in-progress captions, auto-scrolling while at the bottom. -->
<template>
  <div class="transcript">
    <MeterSpeakingBalance v-if="isBalanceVisible" />
    <ol ref="list" class="transcript__list" @scroll="trackScroll">
      <LineTranscript
        v-for="segment in segments"
        :key="segment.id"
        :segment="segment"
        :speaker-label="labelOf(segment.speakerId)"
        :color="colorOf(segment.speakerId)"
        :confusion-count="confusionOf(segment.id)"
        @rename="rename"
      />
      <li v-for="caption in captions" :key="caption.sourceId" class="transcript__caption">
        <span
          class="transcript__caption-speaker"
          :style="{ color: colorOf(caption.speakerId ?? '') }"
        >
          {{ caption.speakerId ? labelOf(caption.speakerId) : '…' }}
        </span>
        {{ caption.text }}
      </li>
      <li v-if="segments.length === 0 && captions.length === 0" class="transcript__empty">
        {{ t('transcript.empty') }}
      </li>
    </ol>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { PALETTE } from '../../Services/ParticipantIdentity'
import { useRoomSession } from '../../Services/RoomSession'
import LineTranscript from './LineTranscript.vue'
import MeterSpeakingBalance from './MeterSpeakingBalance.vue'

const SEGMENT_LIMIT = 300

export default defineComponent({
  name: 'PanelTranscript',
  components: { LineTranscript, MeterSpeakingBalance },
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const list = ref<HTMLElement | null>(null)
    const isAtBottom = ref(true)
    const speakers = computed(
      () => new Map(session.state.speakers.value.map((speaker) => [speaker.id, speaker])),
    )
    const segments = computed(() => session.state.segments.value.slice(-SEGMENT_LIMIT))
    const captions = computed(() => session.state.captions.value)

    const trackScroll = (): void => {
      const element = list.value
      if (element)
        isAtBottom.value = element.scrollHeight - element.scrollTop - element.clientHeight < 40
    }
    watch([segments, captions], async () => {
      if (!isAtBottom.value) return
      await nextTick()
      list.value?.scrollTo({ top: list.value.scrollHeight })
    })

    const rename = (speakerId: string): void => {
      const speaker = speakers.value.get(speakerId)
      if (!speaker) return
      const label = window.prompt(t('transcript.renamePrompt'), speaker.label)?.trim()
      if (label) session.board.upsertSpeaker({ ...speaker, label })
    }

    return {
      t,
      list,
      segments,
      captions,
      trackScroll,
      rename,
      labelOf: (id: string) => speakers.value.get(id)?.label ?? '…',
      colorOf: (id: string) => PALETTE[(speakers.value.get(id)?.colorIndex ?? 0) % PALETTE.length]!,
      confusionOf: (id: string) =>
        session.ux.value.confusionMarks === 'visible'
          ? (session.state.confusion.value.get(id) ?? 0)
          : 0,
      isBalanceVisible: computed(() => session.ux.value.speakingBalance === 'visible'),
    }
  },
})
</script>

<style scoped>
.transcript {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.transcript__list {
  flex: 1;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  list-style: none;
}

.transcript__caption {
  padding: 6px 12px;
  font-size: 13px;
  font-style: italic;
  color: var(--color-text-muted);
}

.transcript__caption-speaker {
  font-style: normal;
  font-weight: 600;
  margin-right: 4px;
}

.transcript__empty {
  padding: 24px 16px;
  color: var(--color-text-muted);
  text-align: center;
}
</style>
