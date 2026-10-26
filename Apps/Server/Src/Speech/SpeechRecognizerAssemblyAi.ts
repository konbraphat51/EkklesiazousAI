// AssemblyAI Universal Streaming (v3) recognizer, used as the fallback provider.
import { WebSocket } from 'ws'
import {
  toLanguageSpoken,
  type RecognitionHandlers,
  type RecognitionOptions,
  type RecognitionSession,
  type SpeechRecognizer,
} from './SpeechRecognizer'

const ASSEMBLYAI_URL = 'wss://streaming.assemblyai.com/v3/ws'
// AssemblyAI accepts 50-1000 ms chunks; client frames are 40 ms, so they are batched
const CHUNK_BYTES = 16000 * 2 * 0.1
const CLOSE_TIMEOUT_MS = 4000

/** Message as sent by AssemblyAI. */
interface AssemblyAiMessage {
  type: 'Begin' | 'Turn' | 'Termination' | 'SpeechStarted' | 'SpeakerRevision' | 'Error'
  turn_order?: number
  end_of_turn?: boolean
  transcript?: string
  language_code?: string
  speaker_label?: string
  words?: Array<{ text: string; start: number; end: number; word_is_final: boolean }>
  error?: string
}

/** Connection settings for AssemblyAI. */
export interface SpeechRecognizerAssemblyAiOptions {
  /** AssemblyAI API key (server-side only). */
  apiKey: string
  /** Streaming speech model, e.g. `universal-3-6-pro`. */
  model: string
}

/** Streams audio to AssemblyAI Universal Streaming. */
export class SpeechRecognizerAssemblyAi implements SpeechRecognizer {
  readonly name = 'assemblyai'

  /**
   * @param options - Credentials and model.
   */
  constructor(private readonly options: SpeechRecognizerAssemblyAiOptions) {}

  async open(
    options: RecognitionOptions,
    handlers: RecognitionHandlers,
  ): Promise<RecognitionSession> {
    const query = new URLSearchParams({
      speech_model: this.options.model,
      encoding: 'pcm_s16le',
      sample_rate: '16000',
      speaker_labels: String(options.isDiarizationWanted),
      language_detection: 'true',
    })
    if (options.terms.length > 0) query.set('keyterms_prompt', JSON.stringify(options.terms))
    const socket = new WebSocket(`${ASSEMBLYAI_URL}?${query.toString()}`, {
      headers: { Authorization: this.options.apiKey },
    })
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })

    const finished = new Promise<void>((resolve) => socket.on('close', () => resolve()))
    const turnsEmitted = new Set<number>()

    socket.on('message', (data, isBinary) => {
      if (isBinary) return
      let message: AssemblyAiMessage
      try {
        message = JSON.parse(data.toString()) as AssemblyAiMessage
      } catch {
        return
      }
      if (message.type === 'Error') {
        handlers.onError(new Error(`AssemblyAI: ${message.error ?? 'unknown error'}`))
        return
      }
      if (message.type !== 'Turn' || message.turn_order === undefined) return
      // a formatted copy of an already finalized turn may follow; emit each turn once
      if (turnsEmitted.has(message.turn_order)) return
      const words = message.words ?? []
      const token = {
        text: message.transcript ?? words.map((word) => word.text).join(' '),
        startMs: words[0]?.start ?? 0,
        endMs: words.at(-1)?.end ?? 0,
        speaker:
          message.speaker_label && message.speaker_label !== 'PENDING'
            ? message.speaker_label
            : null,
        language: toLanguageSpoken(message.language_code),
      }
      if (message.end_of_turn) {
        turnsEmitted.add(message.turn_order)
        handlers.onUpdate({ tokensFinal: [token], tokensInterim: [], isEndpoint: true })
      } else {
        handlers.onUpdate({ tokensFinal: [], tokensInterim: [token], isEndpoint: false })
      }
    })
    socket.on('error', (error) => handlers.onError(error))

    let buffered: Uint8Array[] = []
    let bufferedBytes = 0
    const flush = (): void => {
      if (bufferedBytes === 0 || socket.readyState !== WebSocket.OPEN) return
      socket.send(Buffer.concat(buffered))
      buffered = []
      bufferedBytes = 0
    }

    return {
      sendAudio: (pcm) => {
        buffered.push(pcm)
        bufferedBytes += pcm.byteLength
        if (bufferedBytes >= CHUNK_BYTES) flush()
      },
      finalize: () => {
        flush()
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ForceEndpoint' }))
        }
      },
      close: async () => {
        flush()
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'Terminate' }))
        const timeout = setTimeout(() => socket.terminate(), CLOSE_TIMEOUT_MS)
        await finished
        clearTimeout(timeout)
      },
    }
  }
}
