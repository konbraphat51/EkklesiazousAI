<!-- Shared glossary of terms explained during the meeting; click to open the explaining card. -->
<template>
  <div class="glossary">
    <p v-if="entries.length === 0" class="glossary__empty">{{ t('glossary.empty') }}</p>
    <dl v-else>
      <template v-for="entry in entries" :key="entry.term">
        <dt>
          <button
            v-if="entry.insightId"
            type="button"
            class="glossary__term"
            @click="open(entry.insightId)"
          >
            {{ entry.term }}
          </button>
          <span v-else>{{ entry.term }}</span>
        </dt>
        <dd>{{ entry.definition }}</dd>
      </template>
    </dl>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoomSession } from '../../Services/RoomSession'

export default defineComponent({
  name: 'PanelGlossary',
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const entries = computed(() =>
      [...session.state.glossary.value].sort((a, b) => a.term.localeCompare(b.term)),
    )
    const open = (insightId: string): void => {
      session.focusRequest.value = { itemId: insightId, at: Date.now() }
    }
    return { t, entries, open }
  },
})
</script>

<style scoped>
.glossary {
  padding: 12px 14px;
  overflow-y: auto;
}

.glossary dl {
  margin: 0;
}

.glossary dt {
  margin-top: 10px;
  font-weight: 600;
}

.glossary dd {
  margin: 2px 0 0;
  color: var(--color-text-muted);
}

.glossary__term {
  padding: 0;
  border: none;
  background: none;
  font-weight: 600;
  color: var(--color-accent);
}

.glossary__empty {
  color: var(--color-text-muted);
}
</style>
