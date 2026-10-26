// Soniox real-time recognizer (one bilingual JA/EN model with per-token language and speaker labels).
import { WebSocket } from 'ws'
import {
  toLanguageSpoken,
  type RecognitionHandlers,
  type RecognitionOptions,
  type RecognitionSession,
  type RecognizedToken,
  type SpeechRecognizer,
} from './SpeechRecognizer'

const SONIOX_URL = 'wss://stt-rt.soniox.com/transcribe-websocket'
const KEEPALIVE_INTERVAL_MS = 10_000
const CLOSE_TIMEOUT_MS = 4000

/** Token as sent by Soniox. */
interface SonioxToken {
  text: string
  start_ms?: number
  end_ms?: number
  is_final: boolean
  speaker?: string
  language?: string
}

/** Message as sent by Soniox. */
interface SonioxMessage {
  tokens?: SonioxToken[]
  finished?: boolean
  error_code?: number
  error_message?: string
}

/** Connection settings for Soniox. */
export interface SpeechRecognizerSonioxOptions {
  /** Soniox API key (server-side only). */
  apiKey: string
  /** Real-time model id, e.g. `stt-rt-v5`. */
  model: string
}

/** Streams audio to Soniox over its WebSocket API. */
export class SpeechRecognizerSoniox implements SpeechRecognizer {
  readonly name = 'soniox'

  /**
   * @param options - Credentials and model.
   */
  constructor(private readonly options: SpeechRecognizerSonioxOptions) {}

  async open(
    options: RecognitionOptions,
    handlers: RecognitionHandlers,
  ): Promise<RecognitionSession> {
    const socket = new WebSocket(SONIOX_URL, {
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
    })
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })

    socket.send(
      JSON.stringify({
        model: this.options.model,
        audio_format: 'pcm_s16le',
        sample_rate: 16000,
        num_channels: 1,
        language_hints: options.languageHints,
        enable_language_identification: true,
        enable_speaker_diarization: options.isDiarizationWanted,
        enable_endpoint_detection: true,
        ...(options.terms.length > 0 ? { context: { terms: options.terms } } : {}),
      }),
    )

    let lastAudioAt = Date.now()
    const keepalive = setInterval(() => {
      if (
        Date.now() - lastAudioAt > KEEPALIVE_INTERVAL_MS &&
        socket.readyState === WebSocket.OPEN
      ) {
        socket.send(JSON.stringify({ type: 'keepalive' }))
      }
    }, KEEPALIVE_INTERVAL_MS)

    const finished = new Promise<void>((resolve) => {
      socket.on('close', () => {
        clearInterval(keepalive)
        resolve()
      })
    })

    socket.on('message', (data, isBinary) => {
      if (isBinary) return
      const message = parseMessage(data.toString())
      if (!message) return
      if (message.error_code !== undefined) {
        handlers.onError(new Error(`Soniox ${message.error_code}: ${message.error_message ?? ''}`))
        socket.close()
        return
      }
      if (message.tokens && message.tokens.length > 0) {
        handlers.onUpdate(convertTokens(message.tokens))
      }
      if (message.finished) socket.close()
    })
    socket.on('error', (error) => handlers.onError(error))

    return {
      sendAudio: (pcm) => {
        if (socket.readyState !== WebSocket.OPEN) return
        lastAudioAt = Date.now()
        socket.send(pcm)
      },
      finalize: () => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'finalize' }))
      },
      close: async () => {
        // an empty text frame asks Soniox to flush and finish
        if (socket.readyState === WebSocket.OPEN) socket.send('')
        const timeout = setTimeout(() => socket.terminate(), CLOSE_TIMEOUT_MS)
        await finished
        clearTimeout(timeout)
      },
    }
  }
}

function convertTokens(tokens: SonioxToken[]): {
  tokensFinal: RecognizedToken[]
  tokensInterim: RecognizedToken[]
  isEndpoint: boolean
} {
  const tokensFinal: RecognizedToken[] = []
  const tokensInterim: RecognizedToken[] = []
  let isEndpoint = false
  for (const token of tokens) {
    // `<end>` marks an endpoint, `<fin>` acknowledges a manual finalize
    if (token.text === '<end>' || token.text === '<fin>') {
      isEndpoint = true
      continue
    }
    const converted: RecognizedToken = {
      text: token.text,
      startMs: token.start_ms ?? 0,
      endMs: token.end_ms ?? token.start_ms ?? 0,
      speaker: token.speaker ?? null,
      language: toLanguageSpoken(token.language),
    }
    if (token.is_final) tokensFinal.push(converted)
    else tokensInterim.push(converted)
  }
  return { tokensFinal, tokensInterim, isEndpoint }
}

function parseMessage(text: string): SonioxMessage | null {
  try {
    return JSON.parse(text) as SonioxMessage
  } catch {
    return null
  }
}
