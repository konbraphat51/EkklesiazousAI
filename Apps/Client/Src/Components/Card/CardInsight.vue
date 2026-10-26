<!-- Insight card with progressive disclosure: title → one-line gist → detail (on click) → deep dive. -->
<template>
  <article
    class="card"
    :class="{
      'card--expanded': isExpanded,
      'card--faded': isFaded,
      'card--pinned': insight.isPinned,
      'card--pulsing': isPulsing,
    }"
    :style="{ '--kind-color': `var(--kind-${insight.kind})` }"
    :data-insight-id="insight.id"
    @mouseenter="handleHoverStart"
    @mouseleave="handleHoverEnd"
  >
    <header class="card__header">
      <BadgeKind
        :kind="insight.kind"
        :origin="insight.origin"
        :requester-name="insight.requesterName"
      />
      <span
        v-if="insight.verdict"
        class="card__verdict"
        :class="`card__verdict--${insight.verdict}`"
      >
        {{ t(`verdict.${insight.verdict}`) }}
      </span>
    </header>
    <h3 class="card__title">{{ insight.title }}</h3>

    <button type="button" class="card__gist" :aria-expanded="isExpanded" @click="toggle">
      <span v-if="insight.gist">{{ insight.gist }}</span>
      <span v-else-if="insight.status === 'failed'" class="card__failed">{{
        t('card.failed')
      }}</span>
      <span v-else class="card__skeleton">
        <span class="card__shimmer" />
        <span class="card__progress">{{ progressLabel }}</span>
      </span>
    </button>

    <footer class="card__scent">
      <span v-for="domain in domains" :key="domain" class="card__domain">{{ domain }}</span>
      <span class="card__confidence" :title="t('card.confidence')">
        <span v-for="index in 3" :key="index" :class="{ on: index <= confidenceLevel }" />
      </span>
      <button type="button" class="card__more" @click="toggle">
        {{ isExpanded ? t('card.less') : t('card.more') }}
      </button>
    </footer>

    <section v-if="isExpanded" class="card__detail" @click.stop>
      <div v-if="insight.detailStatus === 'running' && !insight.summary" class="card__skeleton">
        <span class="card__shimmer" />
        <span class="card__progress">{{ t('progress.writing') }}</span>
      </div>
      <p v-if="insight.summary" class="card__summary">{{ insight.summary }}</p>
      <ul v-if="insight.bullets.length > 0" class="card__bullets">
        <li v-for="bullet in insight.bullets" :key="bullet">{{ bullet }}</li>
      </ul>

      <div v-for="section in insight.sections" :key="section.heading" class="card__section">
        <h4>{{ section.heading }}</h4>
        <ul class="card__bullets">
          <li v-for="point in section.points" :key="point">{{ point }}</li>
        </ul>
      </div>
      <p v-if="insight.deepStatus === 'running'" class="card__progress">
        {{ insight.progressNote ? formatProgress(insight.progressNote) : t('progress.planning') }}
      </p>
      <button
        v-if="isDeepAvailable"
        type="button"
        class="button button--small"
        @click="requestDeep"
      >
        {{ insight.deepStatus === 'failed' ? t('card.deepRetry') : t('card.deep') }}
      </button>

      <template v-if="insight.sources.length > 0">
        <button
          v-if="sourceDisplay === 'onDemand' && !isSourcesOpen"
          type="button"
          class="button button--small button--ghost"
          @click="isSourcesOpen = true"
        >
          {{ t('card.showSources', { count: insight.sources.length }) }}
        </button>
        <ListSources v-else :sources="insight.sources" @open="handleSourceOpen" />
      </template>

      <p class="card__provenance">
        <span v-if="insight.reason">{{ t('card.why') }}: {{ insight.reason }}</span>
        <span v-if="insight.triggerQuote" class="card__quote">“{{ insight.triggerQuote }}”</span>
        <span v-if="latencyLabel" class="card__latency">{{ latencyLabel }}</span>
      </p>
    </section>

    <BarActionsCard
      v-if="!isPrivate"
      class="card__actions"
      :vote="ownVote"
      :up-count="upCount"
      :is-pinned="insight.isPinned"
      :is-spotlight-allowed="isSpotlightAllowed"
      @vote="vote"
      @pin="togglePin"
      @spotlight="spotlight"
      @dismiss="dismiss"
    />
  </article>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Insight } from '@ekklesiazous/shared'
import { api } from '../../Services/ApiClient'
import { identity } from '../../Services/ParticipantIdentity'
import { useRoomSession } from '../../Services/RoomSession'
import { useNow } from '../../Composables/UseNow'
import BadgeKind from './BadgeKind.vue'
import BarActionsCard from './BarActionsCard.vue'
import ListSources from './ListSources.vue'

const HOVER_PREFETCH_MS = 400
const FADE_AFTER_MS = 5 * 60_000

export default defineComponent({
  name: 'CardInsight',
  components: { BadgeKind, BarActionsCard, ListSources },
  props: {
    /** The insight to show. */
    insight: { type: Object as PropType<Insight>, required: true },
    /** Private results are not on the board: no shared actions, no layer requests. */
    isPrivate: { type: Boolean, default: false },
    /** Briefly highlights the card (attention cue). */
    isPulsing: { type: Boolean, default: false },
    /** Starts expanded regardless of the disclosure setting. */
    isExpandedInitially: { type: Boolean, default: false },
  },
  setup(props) {
    const { t } = useI18n()
    const session = useRoomSession()
    const now = useNow(30_000)
    const isExpanded = ref(
      props.isExpandedInitially || props.isPrivate || session.ux.value.disclosure === 'full',
    )
    const isSourcesOpen = ref(false)
    const isHovered = ref(false)
    let hoverTimer = 0

    const requestLayer = (layer: 'detail' | 'deep', isPrefetch: boolean): void => {
      if (props.isPrivate) return
      void api
        .requestLayer(session.roomId, props.insight.id, { layer, isPrefetch })
        .catch(() => undefined)
      session.log(isPrefetch ? 'cardHovered' : 'layerRequested', props.insight.id, { layer })
    }
    const ensureDetail = (isPrefetch: boolean): void => {
      if (props.insight.detailStatus === 'none' || props.insight.detailStatus === 'failed') {
        requestLayer('detail', isPrefetch)
      }
    }

    onMounted(() => {
      if (isExpanded.value) ensureDetail(false)
      if (!props.isPrivate) session.log('cardShown', props.insight.id, { kind: props.insight.kind })
    })
    onBeforeUnmount(() => window.clearTimeout(hoverTimer))

    const toggle = (): void => {
      isExpanded.value = !isExpanded.value
      if (isExpanded.value) ensureDetail(false)
      session.log(isExpanded.value ? 'cardExpanded' : 'cardCollapsed', props.insight.id)
    }
    const handleHoverStart = (): void => {
      isHovered.value = true
      hoverTimer = window.setTimeout(() => ensureDetail(true), HOVER_PREFETCH_MS)
    }
    const handleHoverEnd = (): void => {
      isHovered.value = false
      window.clearTimeout(hoverTimer)
    }

    const ownVote = computed(() => props.insight.votes[identity.participantId] ?? null)
    const upCount = computed(
      () => Object.values(props.insight.votes).filter((value) => value === 'up').length,
    )
    const vote = (value: 'up' | 'down'): void => {
      const votes = { ...props.insight.votes }
      if (votes[identity.participantId] === value) delete votes[identity.participantId]
      else votes[identity.participantId] = value
      session.board.patchInsight(props.insight.id, { votes }, 'participant')
      session.log('cardVoted', props.insight.id, { value })
    }
    const togglePin = (): void => {
      session.board.patchInsight(
        props.insight.id,
        { isPinned: !props.insight.isPinned },
        'participant',
      )
      session.log('cardPinned', props.insight.id, { isPinned: !props.insight.isPinned })
    }
    const spotlight = (): void => {
      session.board.patchMeta({ spotlightInsightId: props.insight.id, spotlightAt: Date.now() })
    }
    const dismiss = (): void => {
      session.board.patchInsight(props.insight.id, { status: 'dismissed' }, 'participant')
      session.log('cardDismissed', props.insight.id)
    }
    const requestDeep = (): void => requestLayer('deep', false)
    const handleSourceOpen = (url: string): void =>
      session.log('sourceOpened', props.insight.id, { url })

    const formatProgress = (note: string): string => {
      const [code, count] = note.split(':')
      return t(`progress.${code ?? 'searching'}`, { count: Number(count ?? 0) })
    }
    const progressLabel = computed(() =>
      props.insight.progressNote
        ? formatProgress(props.insight.progressNote)
        : t(props.insight.status === 'writing' ? 'progress.writing' : 'progress.searching', {
            count: 1,
          }),
    )
    const domains = computed(() =>
      [...new Set(props.insight.sources.map((source) => source.publisher).filter(Boolean))].slice(
        0,
        2,
      ),
    )
    const confidenceLevel = computed(() =>
      props.insight.confidence >= 0.75 ? 3 : props.insight.confidence >= 0.45 ? 2 : 1,
    )
    const isFaded = computed(
      () =>
        !props.isPrivate &&
        session.ux.value.cardAging === 'fade' &&
        !props.insight.isPinned &&
        !isHovered.value &&
        now.value - props.insight.createdAt > FADE_AFTER_MS,
    )
    const isDeepAvailable = computed(
      () =>
        !props.isPrivate &&
        props.insight.status === 'ready' &&
        (props.insight.deepStatus === 'none' || props.insight.deepStatus === 'failed'),
    )
    const latencyLabel = computed(() => {
      const timings = props.insight.timings
      if (!timings.firstContentAt) return ''
      return t('card.latency', {
        seconds: ((timings.firstContentAt - timings.utteranceAt) / 1000).toFixed(1),
      })
    })

    return {
      t,
      isExpanded,
      isSourcesOpen,
      toggle,
      handleHoverStart,
      handleHoverEnd,
      ownVote,
      upCount,
      vote,
      togglePin,
      spotlight,
      dismiss,
      requestDeep,
      handleSourceOpen,
      formatProgress,
      progressLabel,
      domains,
      confidenceLevel,
      isFaded,
      isDeepAvailable,
      latencyLabel,
      sourceDisplay: computed(() => session.ux.value.sourceDisplay),
      isSpotlightAllowed: computed(() => session.ux.value.spotlight !== 'off'),
    }
  },
})
</script>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 12px 14px 10px;
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--kind-color);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  transition:
    opacity 0.4s,
    box-shadow 0.3s;
}

.card--faded {
  opacity: 0.55;
}

.card--pinned {
  border-top: 2px solid var(--kind-color);
}

.card--expanded {
  box-shadow: var(--shadow-raised);
}

.card--pulsing {
  animation: pulse 1.6s ease-out 3;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--kind-color) 55%, transparent);
  }
  100% {
    box-shadow: 0 0 0 14px transparent;
  }
}

.card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card__verdict {
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.card__verdict--supported {
  background: #ebfbee;
  color: var(--color-success);
}

.card__verdict--disputed {
  background: #fff0f6;
  color: var(--color-danger);
}

.card__verdict--unclear {
  background: #fff4e6;
  color: var(--color-warning);
}

.card__title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.card__gist {
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  font-size: 15px;
  line-height: 1.45;
  color: var(--color-text);
}

.card__failed {
  color: var(--color-text-muted);
  font-size: 13px;
}

.card__skeleton {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card__shimmer {
  display: block;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #eef0f3 25%, #e2e6eb 50%, #eef0f3 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite linear;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

.card__progress {
  font-size: 12px;
  color: var(--color-text-muted);
}

.card__scent {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.card__domain {
  max-width: 150px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--color-surface-muted);
  font-size: 11px;
  color: var(--color-text-muted);
}

.card__confidence {
  display: inline-flex;
  gap: 2px;
}

.card__confidence span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-border);
}

.card__confidence span.on {
  background: var(--kind-color);
}

.card__more {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  color: var(--color-accent);
}

.card__detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-border);
  cursor: default;
}

.card__summary {
  margin: 0;
}

.card__bullets {
  margin: 0;
  padding-left: 18px;
}

.card__section h4 {
  margin: 4px 0 2px;
  font-size: 12px;
}

.card__provenance {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  font-size: 11px;
  color: var(--color-text-muted);
}

.card__quote {
  font-style: italic;
}

.card__actions {
  position: absolute;
  top: 6px;
  right: 6px;
  opacity: 0;
  background: var(--color-surface);
  transition: opacity 0.15s;
}

.card:hover .card__actions,
.card:focus-within .card__actions {
  opacity: 1;
}
</style>
