<!-- Canvas node of one IBIS element; participants can edit it, after which the agent leaves it alone. -->
<template>
  <div
    class="issue"
    :style="{ '--issue-color': `var(--issue-${data.node.type})` }"
    @dblclick.stop="startEdit"
  >
    <Handle type="target" :position="Position.Left" class="issue__handle" />
    <span class="issue__type">{{ t(`issueType.${data.node.type}`) }}</span>
    <span
      v-if="data.node.isRaisedByAgent && !data.node.isHumanEdited"
      class="issue__agent"
      :title="t('canvas.agentNode')"
      >🤖</span
    >
    <textarea
      v-if="isEditing"
      ref="editor"
      v-model="draft"
      class="issue__editor nodrag"
      rows="2"
      @blur="commit"
      @keydown.enter.prevent="commit"
      @keydown.esc="isEditing = false"
    />
    <p v-else class="issue__text">{{ data.node.text }}</p>
    <ul v-if="data.chips && data.chips.length > 0" class="issue__chips">
      <li v-for="chip in data.chips" :key="chip.insightId">
        <button
          type="button"
          class="issue__chip nodrag"
          :style="{ '--kind-color': `var(--kind-${chip.kind})` }"
          :title="t(`kind.${chip.kind}`)"
          @click.stop="openCard(chip.insightId)"
        >
          {{ chip.title }}
        </button>
      </li>
    </ul>
    <Handle type="source" :position="Position.Right" class="issue__handle" />
  </div>
</template>

<script lang="ts">
import { defineComponent, nextTick, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { Handle, Position } from '@vue-flow/core'
import type { InsightKind, IssueNode } from '@ekklesiazous/shared'
import { useRoomSession } from '../../Services/RoomSession'

export default defineComponent({
  name: 'NodeIssue',
  components: { Handle },
  props: {
    /** Node payload from the layout. */
    data: {
      type: Object as PropType<{
        node: IssueNode
        chips?: Array<{ insightId: string; kind: InsightKind; title: string }>
      }>,
      required: true,
    },
  },
  setup(props) {
    const { t } = useI18n()
    const session = useRoomSession()
    const isEditing = ref(false)
    const draft = ref('')
    const editor = ref<HTMLTextAreaElement | null>(null)

    const startEdit = async (): Promise<void> => {
      draft.value = props.data.node.text
      isEditing.value = true
      await nextTick()
      editor.value?.focus()
    }
    const commit = (): void => {
      if (!isEditing.value) return
      isEditing.value = false
      const text = draft.value.trim()
      if (!text || text === props.data.node.text) return
      session.board.upsertIssue(
        { ...props.data.node, text, isHumanEdited: true, updatedAt: Date.now() },
        'participant',
      )
    }
    const openCard = (insightId: string): void => {
      session.focusRequest.value = { itemId: insightId, at: Date.now() }
    }
    return { t, Position, isEditing, draft, editor, startEdit, commit, openCard }
  },
})
</script>

<style scoped>
.issue {
  position: relative;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-top: 3px solid var(--issue-color);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.issue__type {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--issue-color);
}

.issue__agent {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 11px;
  opacity: 0.7;
}

.issue__text {
  margin: 2px 0 0;
  font-size: 13px;
  font-weight: 500;
}

.issue__editor {
  width: 100%;
  margin-top: 2px;
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  resize: none;
}

.issue__chips {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.issue__chip {
  width: 100%;
  padding: 1px 6px;
  overflow: hidden;
  border: none;
  border-left: 3px solid var(--kind-color);
  border-radius: 4px;
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: 11px;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.issue__chip:hover {
  background: var(--color-accent-soft);
}

.issue__handle {
  opacity: 0;
  pointer-events: none;
}
</style>
