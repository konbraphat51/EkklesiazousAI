<!-- Consent gate before any audio leaves this device. -->
<template>
  <div class="consent" role="dialog" aria-modal="true" :aria-label="t('consent.title')">
    <div class="consent__box">
      <h2>{{ t('consent.title') }}</h2>
      <ul>
        <li>{{ t('consent.pointTranscribe') }}</li>
        <li>{{ t('consent.pointProviders') }}</li>
        <li>{{ t('consent.pointInform') }}</li>
        <li>{{ t('consent.pointStore') }}</li>
      </ul>
      <footer class="consent__footer">
        <button type="button" class="button" @click="$emit('cancel')">
          {{ t('common.cancel') }}
        </button>
        <button type="button" class="button button--primary" @click="$emit('accept')">
          {{ t('consent.accept') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'DialogConsent',
  emits: {
    /** Participant agrees. */
    accept: () => true,
    /** Participant declines. */
    cancel: () => true,
  },
  setup() {
    const { t } = useI18n()
    return { t }
  },
})
</script>

<style scoped>
.consent {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(29, 33, 41, 0.4);
  z-index: 100;
}

.consent__box {
  width: min(520px, 92%);
  padding: 20px 24px;
  border-radius: var(--radius-large);
  background: var(--color-surface);
  box-shadow: var(--shadow-raised);
}

.consent__box h2 {
  margin: 0 0 8px;
  font-size: 17px;
}

.consent__box ul {
  padding-left: 18px;
}

.consent__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
