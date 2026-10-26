// Renders a board as Markdown minutes: summary, decisions, issue map, insights with sources, transcript.
import type { DocumentBoard, Insight, IssueNode } from '@ekklesiazous/shared'
import { formatOffset } from '../Agent/MeetingContext'

const NODE_MARKERS: Record<IssueNode['type'], string> = {
  question: '❓',
  idea: '💡',
  pro: '➕',
  con: '➖',
  decision: '✅',
}

/**
 * Renders the meeting as Markdown.
 *
 * @param board - Board to export.
 */
export function renderMinutes(board: DocumentBoard): string {
  const meta = board.readMeta()
  const speakers = new Map(board.listSpeakers().map((speaker) => [speaker.id, speaker.label]))
  const lines: string[] = [`# ${meta.title}`, '']
  if (meta.startedAt) lines.push(`- Started: ${new Date(meta.startedAt).toISOString()}`, '')
  if (meta.summary) lines.push('## Summary', '', meta.summary, '')

  const issues = board.listIssues().sort((a, b) => a.createdAt - b.createdAt)
  if (issues.length > 0) {
    lines.push('## Issue map', '')
    const renderNode = (node: IssueNode, depth: number): void => {
      lines.push(`${'  '.repeat(depth)}- ${NODE_MARKERS[node.type]} ${node.text}`)
      for (const child of issues.filter((candidate) => candidate.parentId === node.id)) {
        renderNode(child, depth + 1)
      }
    }
    const ids = new Set(issues.map((node) => node.id))
    for (const root of issues.filter((node) => !node.parentId || !ids.has(node.parentId))) {
      renderNode(root, 0)
    }
    lines.push('')
  }

  const insights = board
    .listInsights()
    .filter((insight) => insight.status !== 'dismissed')
    .sort((a, b) => a.createdAt - b.createdAt)
  if (insights.length > 0) {
    lines.push('## Insights', '')
    for (const insight of insights) lines.push(...renderInsight(insight), '')
  }

  const glossary = board.listGlossary()
  if (glossary.length > 0) {
    lines.push('## Glossary', '')
    for (const entry of glossary) lines.push(`- **${entry.term}**: ${entry.definition}`)
    lines.push('')
  }

  lines.push('## Transcript', '')
  for (const segment of board.listSegments()) {
    lines.push(
      `- \`${formatOffset(segment.startMs)}\` **${speakers.get(segment.speakerId) ?? segment.speakerId}**: ${segment.text}`,
    )
  }
  return `${lines.join('\n')}\n`
}

function renderInsight(insight: Insight): string[] {
  const lines = [`### [${insight.kind}] ${insight.title}`, '', insight.gist]
  if (insight.summary) lines.push('', insight.summary)
  for (const bullet of insight.bullets) lines.push(`- ${bullet}`)
  for (const section of insight.sections) {
    lines.push('', `**${section.heading}**`)
    for (const point of section.points) lines.push(`- ${point}`)
  }
  if (insight.sources.length > 0) {
    lines.push('', 'Sources:')
    for (const source of insight.sources) lines.push(`- [${source.title}](${source.url})`)
  }
  return lines
}
