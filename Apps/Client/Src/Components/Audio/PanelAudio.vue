<!-- Audio capture controls with platform-specific instructions (in-person, Google Meet, Zoom, Teams). -->
<template>
  <div class="audio">
    <h3 class="audio__heading">{{ t(`captureMode.${captureMode}`) }}</h3>
    <p class="audio__help">{{ helpText }}</p>

    <template v-if="captureMode === 'demo'">
      <p class="audio__note">{{ t('audio.demoNote') }}</p>
    </template>
    <template v-else-if="captureMode === 'zoomRtms'">
      <p class="audio__note">{{ t('audio.rtmsNote') }}</p>
    </template>
    <template v-else>
      <label class="field">
        <span>{{ t('audio.microphone') }}</span>
        <select v-model="microphoneDeviceId" class="input" :disabled="isActive">
          <option value="">{{ t('audio.defaultMicrophone') }}</option>
          <option v-for="device in devices" :key="device.deviceId" :value="device.deviceId">
            {{ device.label || device.deviceId.slice(0, 8) }}
          </option>
        </select>
      </label>
      <label v-if="captureMode === 'onlinePerParticipant'" class="field">
        <span>{{ t('audio.yourName') }}</span>
        <input v-model="identity.name" class="input" :disabled="isActive" />
      </label>
      <p v-if="captureMode !== 'roomMicrophone'" class="audio__warning">
        {{ t('audio.headphones') }}
      </p>

      <div class="audio__controls">
        <button v-if="!isActive" type="button" class="button button--primary" @click="requestStart">
          🎙 {{ t('audio.start') }}
        </button>
        <button v-else type="button" class="button button--danger" @click="stop">
          ■ {{ t('audio.stop') }}
        </button>
        <MeterLevel :level="capture.level.value" />
      </div>
      <p class="audio__status">
        {{ t(`audio.status.${capture.status.value}`) }}
        <template v-if="capture.recognizer.value"> · {{ capture.recognizer.value }}</template>
      </p>
      <p v-if="capture.errorCode.value" class="audio__error" role="alert">
        {{ t(`audio.error.${capture.errorCode.value}`) }}
        <template v-if="capture.errorDetail.value"> ({{ capture.errorDetail.value }})</template>
      </p>
    </template>

    <DialogConsent v-if="isConsentOpen" @accept="acceptConsent" @cancel="isConsentOpen = false" />
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AudioCapture } from '../../Services/AudioCapture'
import { identity } from '../../Services/ParticipantIdentity'
import { useRoomSession } from '../../Services/RoomSession'
import DialogConsent from './DialogConsent.vue'
import MeterLevel from './MeterLevel.vue'

export default defineComponent({
  name: 'PanelAudio',
  components: { DialogConsent, MeterLevel },
  props: {
    /** Capture session owned by the room page (survives closing this panel). */
    capture: { type: Object as PropType<AudioCapture>, required: true },
  },
  setup(props) {
    const { t } = useI18n()
    const session = useRoomSession()
    const devices = ref<MediaDeviceInfo[]>([])
    const microphoneDeviceId = ref('')
    const isConsentOpen = ref(false)
    const meta = session.state.meta
    const captureMode = computed(() => meta.value.captureMode)
    const isActive = computed(
      () => props.capture.status.value === 'live' || props.capture.status.value === 'starting',
    )

    onMounted(async () => {
      const all = await navigator.mediaDevices?.enumerateDevices().catch(() => [])
      devices.value = (all ?? []).filter(
        (device) => device.kind === 'audioinput' && device.deviceId,
      )
    })

    const start = (): void => {
      const mode = captureMode.value
      void props.capture.start({
        roomId: session.roomId,
        captureMode: mode,
        sourceId: `${mode}:${identity.participantId.slice(0, 8)}`,
        speakerName: mode === 'onlinePerParticipant' ? identity.name || null : null,
        isMeetingAudioIncluded: mode === 'onlineHostCapture',
        microphoneDeviceId: microphoneDeviceId.value,
        languageHints: ['ja', 'en'],
      })
    }
    const requestStart = (): void => {
      if (identity.hasConsentedToCapture) start()
      else isConsentOpen.value = true
    }
    const acceptConsent = (): void => {
      identity.hasConsentedToCapture = true
      isConsentOpen.value = false
      start()
    }

    const helpText = computed(() => {
      const mode = captureMode.value
      if (mode === 'onlineHostCapture')
        return t(`captureHelp.onlineHostCapture.${meta.value.meetingPlatform}`)
      return t(`captureHelp.${mode}`)
    })

    return {
      t,
      identity,
      devices,
      microphoneDeviceId,
      captureMode,
      isActive,
      isConsentOpen,
      helpText,
      requestStart,
      acceptConsent,
      stop: () => props.capture.stop(),
    }
  },
})
</script>

<style scoped>
.audio {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 340px;
}

.audio__heading {
  margin: 0;
  font-size: 14px;
}

.audio__help,
.audio__note,
.audio__status {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: pre-line;
}

.audio__warning {
  margin: 0;
  padding: 6px 8px;
  border-radius: var(--radius-small);
  background: #fff4e6;
  color: var(--color-warning);
  font-size: 12px;
}

.audio__controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.audio__error {
  margin: 0;
  color: var(--color-danger);
  font-size: 12px;
}
</style>
