<!-- Private drawer: explanations and research only this participant sees. -->
<template>
  <aside class="drawer" :aria-label="t('private.heading')">
    <header class="drawer__header">
      <h2>🔒 {{ t('private.heading') }}</h2>
      <button type="button" class="button button--small button--ghost" @click="$emit('close')">
        ✕
      </button>
    </header>
    <p class="drawer__hint">{{ t('private.hint') }}</p>
    <label class="field drawer__background">
      <span>{{ t('private.background') }}</span>
      <input
        v-model="identity.background"
        class="input"
        :placeholder="t('private.backgroundPlaceholder')"
        maxlength="300"
      />
    </label>
    <div class="drawer__items">
      <p v-if="items.length === 0" class="drawer__empty">{{ t('private.empty') }}</p>
      <template v-for="item in items" :key="item.id">
        <CardClarification
          v-if="item.type === 'clarification'"
          :clarification="item.value"
          :is-shared="item.isShared"
          @share="share(item.id)"
          @remove="remove(item.id)"
        />
        <CardInsight v-else :insight="item.value" :is-private="true" />
      </template>
    </div>
  </aside>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { identity } from '../../Services/ParticipantIdentity'
import { useRoomSession } from '../../Services/RoomSession'
import CardInsight from '../Card/CardInsight.vue'
import CardClarification from './CardClarification.vue'

export default defineComponent({
  name: 'DrawerPrivate',
  components: { CardClarification, CardInsight },
  emits: {
    /** Close the drawer. */
    close: () => true,
  },
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const feed = session.privateFeed
    const share = (id: string): void => {
      session.log('clarificationShared', id)
      void feed.share(id).catch(() => undefined)
    }
    return { t, identity, items: feed.items, share, remove: (id: string) => feed.remove(id) }
  },
})
</script>

<style scoped>
.drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px;
  gap: 10px;
  border-right: 1px solid var(--color-border);
  background: #fbfbfd;
}

.drawer__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawer__header h2 {
  margin: 0;
  font-size: 15px;
}

.drawer__hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

.drawer__items {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.drawer__empty {
  color: var(--color-text-muted);
  font-size: 13px;
}
</style>
