// REST client of the server API, including NDJSON streaming for private results.
import type {
  AgentControlRequest,
  Clarification,
  ClarificationAskRequest,
  ClarificationShareResponse,
  DissentRequest,
  Insight,
  InsightLayerRequest,
  InteractionEvent,
  ResearchCommandRequest,
  ResearchCommandResponse,
  RoomCreateRequest,
  RoomCreateResponse,
  ServerCapabilities,
} from '@ekklesiazous/shared'

/** Error carrying the HTTP status. */
export class ApiError extends Error {
  /**
   * @param status - HTTP status.
   * @param message - Server message.
   */
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new ApiError(response.status, body.error ?? response.statusText)
  }
  return (await response.json()) as T
}

function post<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

/**
 * Posts a request and calls `onValue` for every JSON line of the streamed response.
 *
 * @param path - Endpoint.
 * @param body - Request body.
 * @param onValue - Receives each parsed line.
 * @param signal - Cancels the request.
 */
async function postNdjson<T>(
  path: string,
  body: unknown,
  onValue: (value: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok || !response.body) throw new ApiError(response.status, response.statusText)
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) if (line.trim()) onValue(JSON.parse(line) as T)
  }
  if (buffer.trim()) onValue(JSON.parse(buffer) as T)
}

/** Typed access to every server endpoint. */
export const api = {
  /** Reads server capabilities. */
  getCapabilities: () => requestJson<ServerCapabilities>('/api/config'),

  /** Creates a room. */
  createRoom: (request: RoomCreateRequest) => post<RoomCreateResponse>('/api/rooms', request),

  /** Checks that a room exists. */
  getRoom: (roomId: string) => requestJson<{ roomId: string }>(`/api/rooms/${roomId}`),

  /** Starts/pauses the agent or the demo. */
  controlAgent: (roomId: string, request: AgentControlRequest) =>
    post<{ ok: boolean }>(`/api/rooms/${roomId}/agent`, request),

  /** Issues a public research command. */
  issueCommand: (roomId: string, request: ResearchCommandRequest) =>
    post<ResearchCommandResponse>(`/api/rooms/${roomId}/commands`, request),

  /** Issues a private research command, streaming snapshots of the result. */
  issueCommandPrivate: (
    roomId: string,
    request: ResearchCommandRequest,
    onSnapshot: (insight: Insight) => void,
    signal?: AbortSignal,
  ) => postNdjson(`/api/rooms/${roomId}/commands`, request, onSnapshot, signal),

  /** Requests a deeper layer of an insight. */
  requestLayer: (roomId: string, insightId: string, request: InsightLayerRequest) =>
    post<{ isAccepted: boolean }>(`/api/rooms/${roomId}/insights/${insightId}/layers`, request),

  /** Asks for a private clarification or recap, streaming snapshots. */
  askClarification: (
    roomId: string,
    request: ClarificationAskRequest,
    onSnapshot: (clarification: Clarification) => void,
    signal?: AbortSignal,
  ) => postNdjson(`/api/rooms/${roomId}/clarifications`, request, onSnapshot, signal),

  /** Shares a clarification anonymously. */
  shareClarification: (roomId: string, clarificationId: string) =>
    post<ClarificationShareResponse>(
      `/api/rooms/${roomId}/clarifications/${clarificationId}/share`,
      {},
    ),

  /** Raises an anonymous concern through the agent. */
  raiseDissent: (roomId: string, request: DissentRequest) =>
    post<{ result: 'posted' | 'rejected' | 'rateLimited' }>(
      `/api/rooms/${roomId}/dissents`,
      request,
    ),

  /** Sends logged interactions. */
  sendEvents: (roomId: string, events: InteractionEvent[]) =>
    post<{ ok: boolean }>(`/api/rooms/${roomId}/events`, { events }),

  /** URL of the Markdown minutes. */
  minutesUrl: (roomId: string) => `/api/rooms/${roomId}/minutes`,
}
