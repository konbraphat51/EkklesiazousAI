<!-- First-visit prompt for a display name (optional). -->
<template>
  <div class="name" role="dialog" aria-modal="true" :aria-label="t('nameDialog.title')">
    <form class="name__box" @submit.prevent="save">
      <h2>{{ t('nameDialog.title') }}</h2>
      <p>{{ t('nameDialog.text') }}</p>
      <input
        v-model="draft"
        class="input"
        maxlength="80"
        :placeholder="t('nameDialog.placeholder')"
        autofocus
      />
      <footer class="name__footer">
        <button type="button" class="button button--ghost" @click="$emit('done')">
          {{ t('nameDialog.skip') }}
        </button>
        <button type="submit" class="button button--primary" :disabled="!draft.trim()">
          {{ t('nameDialog.save') }}
        </button>
      </footer>
    </form>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { identity } from '../../Services/ParticipantIdentity'

export default defineComponent({
  name: 'DialogName',
  emits: {
    /** Dialog finished (saved or skipped). */
    done: () => true,
  },
  setup(_props, { emit }) {
    const { t } = useI18n()
    const draft = ref(identity.name)
    const save = (): void => {
      identity.name = draft.value.trim()
      emit('done')
    }
    return { t, draft, save }
  },
})
</script>

<style scoped>
.name {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(29, 33, 41, 0.35);
  z-index: 95;
}

.name__box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(420px, 92%);
  padding: 20px 24px;
  border-radius: var(--radius-large);
  background: var(--color-surface);
  box-shadow: var(--shadow-raised);
}

.name__box h2 {
  margin: 0;
  font-size: 17px;
}

.name__box p {
  margin: 0;
  color: var(--color-text-muted);
}

.name__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
