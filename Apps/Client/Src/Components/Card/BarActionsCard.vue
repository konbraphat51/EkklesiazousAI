<!-- Shared actions on a card: pin, vote, spotlight for everyone, dismiss. -->
<template>
  <div class="actions" @click.stop>
    <button
      type="button"
      class="actions__button"
      :class="{ 'actions__button--on': vote === 'up' }"
      :title="t('card.voteUp')"
      @click="$emit('vote', 'up')"
    >
      👍 <span v-if="upCount > 0">{{ upCount }}</span>
    </button>
    <button
      type="button"
      class="actions__button"
      :class="{ 'actions__button--on': vote === 'down' }"
      :title="t('card.voteDown')"
      @click="$emit('vote', 'down')"
    >
      👎
    </button>
    <button
      type="button"
      class="actions__button"
      :class="{ 'actions__button--on': isPinned }"
      :title="isPinned ? t('card.unpin') : t('card.pin')"
      @click="$emit('pin')"
    >
      📌
    </button>
    <button
      v-if="isSpotlightAllowed"
      type="button"
      class="actions__button"
      :title="t('card.spotlight')"
      @click="$emit('spotlight')"
    >
      🔦
    </button>
    <button
      type="button"
      class="actions__button"
      :title="t('card.dismiss')"
      @click="$emit('dismiss')"
    >
      ✕
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'BarActionsCard',
  props: {
    /** This participant's vote. */
    vote: { type: String as PropType<'up' | 'down' | null>, default: null },
    /** Number of upvotes. */
    upCount: { type: Number, default: 0 },
    /** Whether the card is pinned. */
    isPinned: { type: Boolean, default: false },
    /** Whether the room allows spotlighting. */
    isSpotlightAllowed: { type: Boolean, default: true },
  },
  emits: {
    /** Vote cast or withdrawn. */
    vote: (_value: 'up' | 'down') => true,
    /** Pin toggled. */
    pin: () => true,
    /** Spotlight requested. */
    spotlight: () => true,
    /** Dismiss requested. */
    dismiss: () => true,
  },
  setup() {
    const { t } = useI18n()
    return { t }
  },
})
</script>

<style scoped>
.actions {
  display: flex;
  gap: 2px;
}

.actions__button {
  padding: 1px 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  font-size: 12px;
  color: var(--color-text-muted);
  filter: grayscale(0.6);
}

.actions__button:hover {
  border-color: var(--color-border);
  filter: none;
}

.actions__button--on {
  background: var(--color-accent-soft);
  filter: none;
}
</style>
