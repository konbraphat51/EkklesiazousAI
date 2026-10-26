// Output schemas of every agent LLM task. All fields are required (strict-JSON providers demand it);
// "empty" values ('' or []) stand in for absent data.
import { z } from 'zod'

const insightKind = z.enum(['priorArt', 'catchUp', 'factCheck', 'critique', 'answer'])
const triggerPattern = z.enum([
  'newIdea',
  'unfamiliarTerm',
  'claim',
  'anchoring',
  'quickAgreement',
  'authorityAppeal',
  'untestedAssumption',
  'deferredQuestion',
  'explicitRequest',
])
const depthRequested = z.enum(['default', 'quick', 'standard', 'deep'])

/** One research task proposed by the router or the command interpreter. */
export const proposalSchema = z.object({
  kind: insightKind,
  pattern: triggerPattern,
  title: z.string(),
  query: z.string(),
  queryAlternate: z.string(),
  term: z.string(),
  urgency: z.number(),
  reason: z.string(),
  segmentIds: z.array(z.string()),
  depth: depthRequested,
})

/** Router output: topic of the newest speech plus zero or more proposals. */
export const triggerSchema = z.object({
  topic: z.object({ existingTopicId: z.string(), label: z.string() }),
  proposals: z.array(proposalSchema),
})

/** Command interpreter output. */
export const commandSchema = z.object({
  isResearchRequest: z.boolean(),
  proposal: proposalSchema,
})

/** First disclosure layer: one plain sentence. */
export const gistSchema = z.object({
  gist: z.string(),
  confidence: z.number(),
  verdict: z.enum(['supported', 'disputed', 'unclear', 'none']),
  sourceIndices: z.array(z.number()),
  term: z.string(),
  termDefinition: z.string(),
})

/** Second disclosure layer. */
export const detailSchema = z.object({
  summary: z.string(),
  bullets: z.array(z.string()),
  sourceIndices: z.array(z.number()),
})

/** Deep research plan. */
export const deepPlanSchema = z.object({
  subQueries: z.array(z.object({ text: z.string(), language: z.enum(['en', 'ja']) })),
})

/** Third disclosure layer. */
export const deepSchema = z.object({
  sections: z.array(z.object({ heading: z.string(), points: z.array(z.string()) })),
  sourceIndices: z.array(z.number()),
})

/** Private clarification or recap. */
export const clarificationSchema = z.object({
  rephrase: z.string(),
  terms: z.array(z.object({ term: z.string(), explanation: z.string() })),
  background: z.string(),
  sourceIndices: z.array(z.number()),
})

/** Anonymous dissent rewritten as the agent's own critique. */
export const dissentSchema = z.object({
  isAppropriate: z.boolean(),
  title: z.string(),
  gist: z.string(),
  query: z.string(),
})

/** IBIS map maintained by the deep model. */
export const issueMapSchema = z.object({
  summary: z.string(),
  topics: z.array(z.object({ id: z.string(), label: z.string() })),
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['question', 'idea', 'pro', 'con', 'decision']),
      text: z.string(),
      parentId: z.string(),
      topicId: z.string(),
      speakerIds: z.array(z.string()),
    }),
  ),
  insightLinks: z.array(z.object({ insightId: z.string(), nodeId: z.string() })),
  critiqueTargets: z.array(z.object({ nodeId: z.string(), concern: z.string() })),
})

/** Proposal as produced by the models. */
export type Proposal = z.infer<typeof proposalSchema>
/** Router output. */
export type TriggerOutput = z.infer<typeof triggerSchema>
/** Gist output. */
export type GistOutput = z.infer<typeof gistSchema>
/** Detail output. */
export type DetailOutput = z.infer<typeof detailSchema>
/** Deep plan output. */
export type DeepPlanOutput = z.infer<typeof deepPlanSchema>
/** Deep output. */
export type DeepOutput = z.infer<typeof deepSchema>
/** Clarification output. */
export type ClarificationOutput = z.infer<typeof clarificationSchema>
/** Dissent output. */
export type DissentOutput = z.infer<typeof dissentSchema>
/** Issue map output. */
export type IssueMapOutput = z.infer<typeof issueMapSchema>
