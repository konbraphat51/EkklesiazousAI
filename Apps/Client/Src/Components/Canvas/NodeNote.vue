<!-- Editable sticky note placed by a participant. -->
<template>
  <div class="note" :style="{ background: color }">
    <textarea
      v-model="text"
      class="note__text nodrag"
      rows="4"
      :placeholder="t('canvas.notePlaceholder')"
      @blur="save"
    />
    <footer class="note__footer">
      <span>{{ data.note.authorName }}</span>
      <button
        type="button"
        class="note__delete nodrag"
        :title="t('canvas.deleteNote')"
        @click="remove"
      >
        ✕
      </button>
    </footer>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Note } from '@ekklesiazous/shared'
import { useRoomSession } from '../../Services/RoomSession'

const NOTE_COLORS = ['#fff3bf', '#d3f9d8', '#d0ebff', '#ffe3e3', '#f3d9fa']

export default defineComponent({
  name: 'NodeNote',
  props: {
    /** Node payload from the layout. */
    data: { type: Object as PropType<{ note: Note }>, required: true },
  },
  setup(props) {
    const { t } = useI18n()
    const session = useRoomSession()
    const text = ref(props.data.note.text)
    watch(
      () => props.data.note.text,
      (value) => (text.value = value),
    )
    const save = (): void => {
      if (text.value === props.data.note.text) return
      session.board.upsertNote({ ...props.data.note, text: text.value, updatedAt: Date.now() })
    }
    const remove = (): void => session.board.removeNote(props.data.note.id)
    return {
      t,
      text,
      save,
      remove,
      color: computed(() => NOTE_COLORS[props.data.note.colorIndex % NOTE_COLORS.length]),
    }
  },
})
</script>

<style scoped>
.note {
  display: flex;
  flex-direction: column;
  padding: 10px;
  border-radius: 4px;
  box-shadow: var(--shadow-card);
}

.note__text {
  border: none;
  background: transparent;
  resize: none;
  font-size: 14px;
}

.note__text:focus {
  outline: none;
}

.note__footer {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.5);
}

.note__delete {
  border: none;
  background: none;
  color: inherit;
}
</style>
