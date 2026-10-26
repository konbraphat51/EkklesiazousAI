<!-- The shared infinite canvas: renders the active layout with Vue Flow and handles placement,
     notes, live-follow, focus requests, attention cues and cursors. -->
<template>
  <div
    ref="root"
    class="canvas"
    @dblclick="handleDoubleClick"
    @mousemove="handlePointerMove"
    @mouseleave="clearCursor"
  >
    <VueFlow
      id="board"
      :nodes="flowNodes"
      :edges="flowEdges"
      :min-zoom="0.12"
      :max-zoom="2"
      :zoom-on-double-click="false"
      :nodes-connectable="false"
      :elements-selectable="false"
      :only-render-visible-elements="true"
      :default-viewport="{ x: 120, y: 300, zoom: 0.85 }"
      @node-drag-stop="handleDragStop"
      @node-mouse-enter="(event) => (hoveredNodeId = event.node.id)"
      @node-mouse-leave="hoveredNodeId = null"
      @move-start="handleMoveStart"
    >
      <template #node-insight="nodeProps"><NodeInsight :data="nodeProps.data" /></template>
      <template #node-segment="nodeProps"><NodeSegment :data="nodeProps.data" /></template>
      <template #node-topicFrame="nodeProps"><NodeTopicFrame :data="nodeProps.data" /></template>
      <template #node-issue="nodeProps"><NodeIssue :data="nodeProps.data" /></template>
      <template #node-note="nodeProps"><NodeNote :data="nodeProps.data" /></template>
      <template #node-timeAxis="nodeProps"><NodeTimeAxis :data="nodeProps.data" /></template>
      <Background pattern-color="#d5dae1" :gap="24" />
      <MiniMap pannable zoomable :node-color="colorMiniMapNode" />
      <Controls :show-interactive="false" />
    </VueFlow>

    <OverlayCursors :peers="peers" :viewport="viewport" :layout="layoutId" />

    <div class="canvas__buttons">
      <button
        v-if="!isFollowing && layoutResult.focusPoint"
        type="button"
        class="button button--primary"
        @click="followLive"
      >
        {{ t('canvas.jumpToLive') }}
      </button>
      <button type="button" class="button" @click="addNoteAtCenter">
        ＋ {{ t('canvas.addNote') }}
      </button>
    </div>
    <p v-if="isEmpty" class="canvas__empty">
      {{ t(`canvas.empty.${layoutId}`) }}
    </p>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { VueFlow, useVueFlow, type Edge, type Node, type NodeDragEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { nanoid } from '../../Services/IdGenerator'
import { identity, pickColor } from '../../Services/ParticipantIdentity'
import { useRoomSession } from '../../Services/RoomSession'
import { useNow } from '../../Composables/UseNow'
import { usePresence } from '../../Composables/UsePresence'
import { getLayout } from '../../Layouts/LayoutRegistry'
import type { LayoutResult } from '../../Layouts/LayoutTypes'
import NodeInsight from './NodeInsight.vue'
import NodeIssue from './NodeIssue.vue'
import NodeNote from './NodeNote.vue'
import NodeSegment from './NodeSegment.vue'
import NodeTimeAxis from './NodeTimeAxis.vue'
import NodeTopicFrame from './NodeTopicFrame.vue'
import OverlayCursors from './OverlayCursors.vue'

const PULSE_MS = 5000
const AUTO_PAN_IDLE_MS = 5000
const CURSOR_THROTTLE_MS = 60

export default defineComponent({
  name: 'CanvasBoard',
  components: {
    VueFlow,
    Background,
    Controls,
    MiniMap,
    NodeInsight,
    NodeIssue,
    NodeNote,
    NodeSegment,
    NodeTimeAxis,
    NodeTopicFrame,
    OverlayCursors,
  },
  setup() {
    const { t } = useI18n()
    const session = useRoomSession()
    const { state, board } = session
    const flow = useVueFlow('board')
    const root = ref<HTMLElement | null>(null)
    const now = useNow(5000)
    const peers = usePresence(session.connection)
    const pulsing = reactive(new Set<string>())
    // the hovered card rises above overlapping neighbours
    const hoveredNodeId = ref<string | null>(null)
    const isFollowing = ref(true)
    let lastUserMoveAt = 0
    let lastCursorAt = 0

    const layoutId = computed(() => session.ux.value.layout)
    const layoutResult = computed<LayoutResult>(() => {
      void state.placementsVersion.value
      return getLayout(layoutId.value).compute({
        insights: state.insights.value,
        segments: state.segments.value,
        speakers: state.speakers.value,
        topics: state.topics.value,
        issues: state.issues.value,
        notes: state.notes.value,
        placements: board.listPlacements(layoutId.value),
        meetingStartedAt: state.meta.value.startedAt,
        now: now.value,
      })
    })

    const flowNodes = computed<Node[]>(() =>
      layoutResult.value.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: { x: node.x, y: node.y },
        data: { ...node.data, isPulsing: pulsing.has(node.id) },
        draggable: node.isDraggable,
        selectable: false,
        zIndex: node.id === hoveredNodeId.value ? 100 : (node.zIndex ?? 1),
        style: {
          width: `${node.width}px`,
          ...(node.height ? { height: `${node.height}px` } : {}),
        },
      })),
    )
    const flowEdges = computed<Edge[]>(() =>
      layoutResult.value.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        selectable: false,
        style: {
          stroke: edge.color,
          strokeWidth: 2,
          ...(edge.isDashed ? { strokeDasharray: '6 4' } : {}),
        },
      })),
    )

    const centerOn = (x: number, y: number): void => {
      void flow.setCenter(x, y, { zoom: Math.max(flow.viewport.value.zoom, 0.7), duration: 500 })
    }
    const followLive = (): void => {
      isFollowing.value = true
      const focus = layoutResult.value.focusPoint
      if (focus) centerOn(focus.x, focus.y)
    }
    watch(
      () => layoutResult.value.focusPoint,
      (focus, previous) => {
        if (!focus || !isFollowing.value) return
        if (previous && Math.abs(focus.x - previous.x) < 1 && Math.abs(focus.y - previous.y) < 1)
          return
        centerOn(focus.x, focus.y)
      },
    )
    // the timeline follows "now"; structural layouts open with an overview
    const showLayoutInitially = (): void => {
      isFollowing.value = layoutId.value === 'timeline'
      session.connection.setPresence('layout', layoutId.value)
      setTimeout(() => {
        const focus = layoutResult.value.focusPoint
        if (layoutId.value === 'timeline' && focus) centerOn(focus.x, focus.y)
        else void flow.fitView({ padding: 0.15, duration: 400, maxZoom: 1 })
      }, 80)
    }
    watch(layoutId, showLayoutInitially)
    // the first time content exists (after the initial sync) the view is framed once
    const stopFirstFrame = watch(
      () => layoutResult.value.nodes.length > 1,
      (hasContent) => {
        if (!hasContent) return
        showLayoutInitially()
        stopFirstFrame()
      },
    )

    const handleMoveStart = (event: { event?: { sourceEvent?: unknown } }): void => {
      // programmatic moves have no source event; user pans/zooms stop live-follow
      if (event.event?.sourceEvent) {
        isFollowing.value = false
        lastUserMoveAt = Date.now()
      }
    }
    const handleDragStop = (event: NodeDragEvent): void => {
      for (const node of event.nodes) {
        board.setPlacement(layoutId.value, node.id, { x: node.position.x, y: node.position.y })
      }
      lastUserMoveAt = Date.now()
    }

    const pulse = (nodeId: string): void => {
      pulsing.add(nodeId)
      setTimeout(() => pulsing.delete(nodeId), PULSE_MS)
    }
    const focusNode = (nodeId: string): void => {
      const node = layoutResult.value.nodes.find((candidate) => candidate.id === nodeId)
      if (!node) return
      isFollowing.value = false
      centerOn(node.x + node.width / 2, node.y + 80)
      pulse(nodeId)
    }
    watch(session.focusRequest, (request) => {
      if (request) focusNode(`insight:${request.itemId}`)
    })

    // attention cue for newly delivered insights
    // cards delivered before this page opened (initial sync) are history, not news
    const openedAt = Date.now()
    let knownInsightIds = new Set(state.insights.value.map((insight) => insight.id))
    watch(state.insights, (insights) => {
      const fresh = insights.filter(
        (insight) =>
          !knownInsightIds.has(insight.id) &&
          (insight.timings.releasedAt ?? insight.createdAt) >= openedAt,
      )
      knownInsightIds = new Set(insights.map((insight) => insight.id))
      const cue = session.ux.value.attentionCue
      for (const insight of fresh) {
        if (cue === 'pulse') pulse(`insight:${insight.id}`)
        if (cue === 'autoPan' && Date.now() - lastUserMoveAt > AUTO_PAN_IDLE_MS) {
          setTimeout(() => focusNode(`insight:${insight.id}`), 100)
        }
      }
    })

    const toFlowPoint = (event: MouseEvent): { x: number; y: number } | null => {
      const bounds = root.value?.getBoundingClientRect()
      if (!bounds) return null
      return flow.project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top })
    }
    const createNote = (position: { x: number; y: number }): void => {
      const id = nanoid()
      const time = Date.now()
      board.upsertNote({
        id,
        text: '',
        colorIndex: Math.floor(Math.random() * 5),
        authorName: identity.name || t('common.anonymous'),
        createdAt: time,
        updatedAt: time,
      })
      board.setPlacement(layoutId.value, `note:${id}`, position)
      session.log('noteCreated', id)
    }
    const handleDoubleClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement
      if (target.closest('.vue-flow__node, .vue-flow__controls, .vue-flow__minimap, button')) return
      const point = toFlowPoint(event)
      if (point) createNote(point)
    }
    const addNoteAtCenter = (): void => {
      const bounds = root.value?.getBoundingClientRect()
      if (!bounds) return
      createNote(flow.project({ x: bounds.width / 2 - 110, y: bounds.height / 2 - 60 }))
    }

    const handlePointerMove = (event: MouseEvent): void => {
      const time = Date.now()
      if (time - lastCursorAt < CURSOR_THROTTLE_MS) return
      lastCursorAt = time
      const point = toFlowPoint(event)
      if (point) session.connection.setPresence('cursor', point)
    }
    const clearCursor = (): void => session.connection.setPresence('cursor', null)

    session.connection.setPresence('user', {
      name: identity.name || t('common.anonymous'),
      color: pickColor(identity.participantId),
      participantId: identity.participantId,
    })
    session.connection.setPresence('layout', layoutId.value)
    onBeforeUnmount(clearCursor)

    const colorMiniMapNode = (node: Node): string => {
      if (node.type === 'insight') return '#4f6bed'
      if (node.type === 'issue') return '#f08c00'
      if (node.type === 'note') return '#fcc419'
      if (node.type === 'topicFrame') return 'rgba(79,107,237,0.12)'
      return '#ced4da'
    }

    return {
      t,
      root,
      peers,
      layoutId,
      layoutResult,
      isEmpty: computed(() =>
        layoutResult.value.isPeripheral
          ? state.insights.value.length === 0
          : layoutResult.value.nodes.length <= 1,
      ),
      flowNodes,
      flowEdges,
      isFollowing,
      viewport: flow.viewport,
      followLive,
      handleMoveStart,
      handleDragStop,
      hoveredNodeId,
      handleDoubleClick,
      addNoteAtCenter,
      handlePointerMove,
      clearCursor,
      colorMiniMapNode,
    }
  },
})
</script>

<style scoped>
.canvas {
  position: relative;
  width: 100%;
  height: 100%;
}

.canvas__buttons {
  position: absolute;
  left: 16px;
  top: 16px;
  display: flex;
  gap: 8px;
  z-index: 5;
}

.canvas__empty {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: 420px;
  margin: 0;
  text-align: center;
  color: var(--color-text-muted);
  pointer-events: none;
}

:deep(.vue-flow__node) {
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  text-align: left;
}

:deep(.vue-flow__node-topicFrame) {
  pointer-events: none;
}
</style>
