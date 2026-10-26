<!-- Right side panel with tabs: transcript, meeting summary, glossary. -->
<template>
  <aside class="side">
    <nav class="side__tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab"
        type="button"
        role="tab"
        class="side__tab"
        :class="{ 'side__tab--active': tab === active }"
        :aria-selected="tab === active"
        @click="active = tab"
      >
        {{ t(`side.${tab}`) }}
      </button>
    </nav>
    <PanelTranscript v-show="active === 'transcript'" class="side__body" />
    <PanelSummary v-if="active === 'summary'" class="side__body" />
    <PanelGlossary v-if="active === 'glossary'" class="side__body" />
  </aside>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PanelGlossary from './PanelGlossary.vue'
import PanelSummary from './PanelSummary.vue'
import PanelTranscript from './PanelTranscript.vue'

type SideTab = 'transcript' | 'summary' | 'glossary'

export default defineComponent({
  name: 'PanelSide',
  components: { PanelGlossary, PanelSummary, PanelTranscript },
  setup() {
    const { t } = useI18n()
    const tabs: SideTab[] = ['transcript', 'summary', 'glossary']
    return { t, tabs, active: ref<SideTab>('transcript') }
  },
})
</script>

<style scoped>
.side {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface);
}

.side__tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.side__tab {
  flex: 1;
  padding: 8px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--color-text-muted);
  font-size: 13px;
}

.side__tab--active {
  border-bottom-color: var(--color-accent);
  color: var(--color-text);
  font-weight: 600;
}

.side__body {
  flex: 1;
  min-height: 0;
}
</style>
