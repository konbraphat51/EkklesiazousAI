<!-- Form that creates a meeting room for a platform and capture mode. -->
<template>
  <form class="form" @submit.prevent="submit">
    <label class="field">
      <span>{{ t('lobby.title') }}</span>
      <input
        v-model="title"
        class="input"
        required
        maxlength="120"
        :placeholder="t('lobby.titlePlaceholder')"
      />
    </label>
    <label class="field">
      <span>{{ t('lobby.platform') }}</span>
      <select v-model="platform" class="input">
        <option v-for="option in platforms" :key="option" :value="option">
          {{ t(`platform.${option}`) }}
        </option>
      </select>
    </label>
    <label class="field">
      <span>{{ t('lobby.captureMode') }}</span>
      <select v-model="captureMode" class="input">
        <option v-for="option in captureModes" :key="option" :value="option">
          {{ t(`captureMode.${option}`) }}
        </option>
      </select>
    </label>
    <p class="form__hint">{{ t(`captureModeHint.${captureMode}`) }}</p>
    <button class="button button--primary" type="submit" :disabled="isBusy">
      {{ t('lobby.create') }}
    </button>
  </form>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MEETING_PLATFORMS, type CaptureMode, type MeetingPlatform } from '@ekklesiazous/shared'

export default defineComponent({
  name: 'FormRoomCreate',
  props: {
    /** Whether the server can receive Zoom RTMS audio. */
    isZoomRtmsEnabled: { type: Boolean, default: false },
    /** Whether the server can send meeting bots. */
    isMeetingBotEnabled: { type: Boolean, default: false },
    /** Disables the submit button while a request runs. */
    isBusy: { type: Boolean, default: false },
  },
  emits: {
    /** Fired with the new room settings. */
    create: (_value: {
      title: string
      meetingPlatform: MeetingPlatform
      captureMode: CaptureMode
    }) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n()
    const title = ref('')
    const platform = ref<MeetingPlatform>('inPerson')
    const captureModes = computed<CaptureMode[]>(() => {
      if (platform.value === 'inPerson') return ['roomMicrophone']
      const online: CaptureMode[] = [
        'onlineHostCapture',
        'onlinePerParticipant',
        ...(props.isMeetingBotEnabled ? (['meetingBot'] as const) : []),
      ]
      return platform.value === 'zoom' && props.isZoomRtmsEnabled ? ['zoomRtms', ...online] : online
    })
    const captureMode = ref<CaptureMode>('roomMicrophone')
    watch(captureModes, (modes) => (captureMode.value = modes[0]!), { immediate: true })

    const submit = (): void =>
      emit('create', {
        title: title.value.trim(),
        meetingPlatform: platform.value,
        captureMode: captureMode.value,
      })
    return { t, title, platform, platforms: MEETING_PLATFORMS, captureMode, captureModes, submit }
  },
})
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form__hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
