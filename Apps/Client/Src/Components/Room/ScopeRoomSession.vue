<!-- Provides a room session to its slot, for pages that show only parts of a room (Meet side panel). -->
<template>
  <slot />
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted } from 'vue'
import { api } from '../../Services/ApiClient'
import { provideRoomSession } from '../../Services/RoomSession'

export default defineComponent({
  name: 'ScopeRoomSession',
  props: {
    /** Room to open. */
    roomId: { type: String, required: true },
  },
  setup(props) {
    const session = provideRoomSession(props.roomId)
    onMounted(async () => {
      session.capabilities.value = await api.getCapabilities().catch(() => null)
      session.log('sessionStarted', null, { surface: 'meetSidePanel' })
    })
    onBeforeUnmount(() => session.dispose())
  },
})
</script>
