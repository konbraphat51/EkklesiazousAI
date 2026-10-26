<!-- Google Meet main stage (shared): every participant loads the room's canvas in their own frame. -->
<template>
  <PageRoom v-if="roomId" :room-id="roomId" />
  <p v-else class="stage__message">{{ message }}</p>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createMeetSession, parseMeetActivityData } from '../../Services/MeetAddon'
import PageRoom from '../Room/PageRoom.vue'

export default defineComponent({
  name: 'PageMeetStage',
  components: { PageRoom },
  setup() {
    const { t } = useI18n()
    const roomId = ref('')
    const message = ref(t('meetAddon.loading'))
    onMounted(async () => {
      try {
        const session = await createMeetSession()
        const stage = await session.createMainStageClient()
        const data = parseMeetActivityData((await stage.getActivityStartingState()).additionalData)
        if (data) roomId.value = data.roomId
        else message.value = t('meetAddon.noRoom')
      } catch {
        message.value = t('meetAddon.outsideMeet')
      }
    })
    return { roomId, message }
  },
})
</script>

<style scoped>
.stage__message {
  padding: 40px;
  text-align: center;
  color: var(--color-text-muted);
}
</style>
