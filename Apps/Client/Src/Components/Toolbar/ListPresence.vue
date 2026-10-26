<!-- Avatars of participants currently connected. -->
<template>
  <ul class="presence" :aria-label="t('presence.label')">
    <li
      v-for="peer in peers.slice(0, 6)"
      :key="peer.clientId"
      class="presence__avatar"
      :style="{ background: peer.user.color }"
      :title="peer.user.name"
    >
      {{ initialOf(peer.user.name) }}
    </li>
    <li v-if="peers.length > 6" class="presence__more">+{{ peers.length - 6 }}</li>
  </ul>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePresence } from '../../Composables/UsePresence'
import { useRoomSession } from '../../Services/RoomSession'

export default defineComponent({
  name: 'ListPresence',
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    return {
      t,
      peers: usePresence(session.connection),
      initialOf: (name: string) => (name.trim()[0] ?? '?').toUpperCase(),
    }
  },
})
</script>

<style scoped>
.presence {
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
}

.presence__avatar,
.presence__more {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-left: -6px;
  border: 2px solid var(--color-surface);
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.presence__more {
  background: var(--color-text-muted);
}
</style>
