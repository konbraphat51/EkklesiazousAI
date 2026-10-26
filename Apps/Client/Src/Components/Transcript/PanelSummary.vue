<!-- "Meeting so far": rolling summary, decisions and open questions from the issue map. -->
<template>
  <div class="summary">
    <section>
      <h3>{{ t('summary.heading') }}</h3>
      <p v-if="meta.summary">{{ meta.summary }}</p>
      <p v-else class="summary__empty">{{ t('summary.empty') }}</p>
    </section>
    <section v-if="decisions.length > 0">
      <h3>{{ t('summary.decisions') }}</h3>
      <ul>
        <li v-for="node in decisions" :key="node.id">✅ {{ node.text }}</li>
      </ul>
    </section>
    <section v-if="openQuestions.length > 0">
      <h3>{{ t('summary.openQuestions') }}</h3>
      <ul>
        <li v-for="node in openQuestions" :key="node.id">❓ {{ node.text }}</li>
      </ul>
    </section>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoomSession } from '../../Services/RoomSession'

export default defineComponent({
  name: 'PanelSummary',
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const issues = computed(() => session.state.issues.value)
    const decisions = computed(() => issues.value.filter((node) => node.type === 'decision'))
    const openQuestions = computed(() =>
      issues.value.filter(
        (node) =>
          node.type === 'question' &&
          !issues.value.some((child) => child.parentId === node.id && child.type === 'decision'),
      ),
    )
    return { t, meta: session.state.meta, decisions, openQuestions }
  },
})
</script>

<style scoped>
.summary {
  padding: 12px 14px;
  overflow-y: auto;
}

.summary h3 {
  margin: 12px 0 4px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.summary p,
.summary ul {
  margin: 0;
}

.summary ul {
  padding-left: 4px;
  list-style: none;
}

.summary__empty {
  color: var(--color-text-muted);
}
</style>
