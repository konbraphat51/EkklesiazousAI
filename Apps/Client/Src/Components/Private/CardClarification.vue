<!-- A private explanation or recap, with an option to share it anonymously. -->
<template>
  <article class="clarification">
    <p v-if="clarification.quote" class="clarification__quote">“{{ quoteShort }}”</p>
    <div
      v-if="!clarification.rephrase && clarification.status === 'writing'"
      class="clarification__waiting"
    >
      {{ t('private.writing') }}
    </div>
    <p v-if="clarification.status === 'failed'" class="clarification__failed">
      {{ t('private.failed') }}
    </p>
    <p v-if="clarification.rephrase" class="clarification__rephrase">
      {{ clarification.rephrase }}
    </p>
    <dl v-if="clarification.terms.length > 0" class="clarification__terms">
      <template v-for="term in clarification.terms" :key="term.term">
        <dt>{{ term.term }}</dt>
        <dd>{{ term.explanation }}</dd>
      </template>
    </dl>
    <p v-if="clarification.background" class="clarification__background">
      {{ clarification.background }}
    </p>
    <ListSources v-if="clarification.sources.length > 0" :sources="clarification.sources" />
    <footer class="clarification__footer">
      <button
        v-if="clarification.status === 'ready' && clarification.quote"
        type="button"
        class="button button--small"
        :disabled="isShared"
        @click="$emit('share')"
      >
        {{ isShared ? t('private.shared') : t('private.share') }}
      </button>
      <button type="button" class="button button--small button--ghost" @click="$emit('remove')">
        {{ t('private.remove') }}
      </button>
    </footer>
  </article>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Clarification } from '@ekklesiazous/shared'
import ListSources from '../Card/ListSources.vue'

export default defineComponent({
  name: 'CardClarification',
  components: { ListSources },
  props: {
    /** The private explanation. */
    clarification: { type: Object as PropType<Clarification>, required: true },
    /** Whether it was already shared. */
    isShared: { type: Boolean, default: false },
  },
  emits: {
    /** Share anonymously on the board. */
    share: () => true,
    /** Remove from the drawer. */
    remove: () => true,
  },
  setup(props) {
    const { t } = useI18n()
    return {
      t,
      quoteShort: computed(() =>
        props.clarification.quote.length > 140
          ? `…${props.clarification.quote.slice(-140)}`
          : props.clarification.quote,
      ),
    }
  },
})
</script>

<style scoped>
.clarification {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.clarification__quote {
  margin: 0;
  font-size: 12px;
  font-style: italic;
  color: var(--color-text-muted);
}

.clarification__waiting,
.clarification__failed {
  font-size: 12px;
  color: var(--color-text-muted);
}

.clarification__rephrase {
  margin: 0;
  font-size: 14px;
}

.clarification__terms {
  margin: 0;
  font-size: 13px;
}

.clarification__terms dt {
  font-weight: 600;
}

.clarification__terms dd {
  margin: 0 0 4px;
  color: var(--color-text-muted);
}

.clarification__background {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

.clarification__footer {
  display: flex;
  gap: 6px;
}
</style>
