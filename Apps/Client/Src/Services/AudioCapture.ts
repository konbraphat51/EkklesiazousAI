// Captures microphone and/or meeting audio (tab or system), converts it to 16 kHz PCM16 and streams it
// to the server's audio socket.
import { shallowRef, type ShallowRef } from 'vue'
import type { AudioMessageServer, CaptureMode } from '@ekklesiazous/shared'

/** Capture lifecycle. */
export type CaptureStatus = 'idle' | 'starting' | 'live' | 'error'

/** What to capture and how to label it. */
export interface AudioCaptureOptions {
  /** Target room. */
  roomId: string
  /** Capture mode (decides diarization and microphone processing). */
  captureMode: CaptureMode
  /** Stream id unique within the room. */
  sourceId: string
  /** Own name for per-participant streams; null when diarized. */
  speakerName: string | null
  /** Whether to also capture the online meeting's audio (tab or system). */
  isMeetingAudioIncluded: boolean
  /** Microphone device, or '' for the default; null for no microphone. */
  microphoneDeviceId: string | null
  /** Expected languages. */
  languageHints: string[]
}

/** Reasons a capture can fail, mapped to localized messages by the UI. */
export type CaptureErrorCode =
  | 'microphoneDenied'
  | 'meetingAudioMissing'
  | 'meetingAudioCancelled'
  | 'serverRejected'
  | 'connectionLost'

/** One active capture session. */
export class AudioCapture {
  /** Lifecycle status. */
  readonly status: ShallowRef<CaptureStatus> = shallowRef('idle')
  /** Input level 0..1 for the meter. */
  readonly level: ShallowRef<number> = shallowRef(0)
  /** Error code when status is `error`. */
  readonly errorCode: ShallowRef<CaptureErrorCode | null> = shallowRef(null)
  /** Server-side error detail, if any. */
  readonly errorDetail: ShallowRef<string> = shallowRef('')
  /** Recognizer reported by the server. */
  readonly recognizer: ShallowRef<string> = shallowRef('')
  private context: AudioContext | null = null
  private streams: MediaStream[] = []
  private socket: WebSocket | null = null
  private levelTimer = 0

  /**
   * Starts capturing and streaming.
   *
   * @param options - What to capture.
   */
  async start(options: AudioCaptureOptions): Promise<void> {
    this.stop()
    this.status.value = 'starting'
    this.errorCode.value = null
    try {
      const inputs = await this.acquireStreams(options)
      const context = new AudioContext()
      this.context = context
      await context.audioWorklet.addModule('/Worklets/PcmDownsampler.js')
      const mixer = context.createGain()
      for (const stream of inputs) context.createMediaStreamSource(stream).connect(mixer)
      const worklet = new AudioWorkletNode(context, 'pcm-downsampler')
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      mixer.connect(worklet)
      mixer.connect(analyser)
      this.startLevelMeter(analyser)
      this.socket = this.openSocket(options)
      worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(event.data)
      }
    } catch (error) {
      this.fail(classifyError(error))
      this.release()
    }
  }

  /** Stops capturing and closes the stream. */
  stop(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'stop' }))
    }
    this.socket?.close()
    this.socket = null
    this.release()
    if (this.status.value !== 'error') this.status.value = 'idle'
  }

  private async acquireStreams(options: AudioCaptureOptions): Promise<MediaStream[]> {
    const streams: MediaStream[] = []
    if (options.isMeetingAudioIncluded) {
      // Chrome requires video in getDisplayMedia; it is dropped immediately
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { suppressLocalAudioPlayback: false } as MediaTrackConstraints,
        systemAudio: 'include',
        selfBrowserSurface: 'exclude',
      } as DisplayMediaStreamOptions)
      for (const track of display.getVideoTracks()) track.stop()
      if (display.getAudioTracks().length === 0) throw new CaptureError('meetingAudioMissing')
      streams.push(display)
    }
    if (options.microphoneDeviceId !== null) {
      // a room microphone must hear everyone: no echo cancellation, suppression or gain control
      const isRoom = options.captureMode === 'roomMicrophone'
      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: options.microphoneDeviceId ? { exact: options.microphoneDeviceId } : undefined,
          echoCancellation: !isRoom,
          noiseSuppression: !isRoom,
          autoGainControl: !isRoom,
          channelCount: 1,
        },
      })
      streams.push(microphone)
    }
    this.streams = streams
    return streams
  }

  private openSocket(options: AudioCaptureOptions): WebSocket {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${scheme}://${window.location.host}/ws/audio/${options.roomId}`)
    socket.binaryType = 'arraybuffer'
    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'start',
          sourceId: options.sourceId,
          captureMode: options.captureMode,
          speakerName: options.speakerName,
          languageHints: options.languageHints,
        }),
      )
    }
    socket.onmessage = (event: MessageEvent<string>) => {
      const message = JSON.parse(event.data) as AudioMessageServer
      if (message.type === 'ready') {
        this.recognizer.value = message.recognizer
        this.status.value = 'live'
      } else {
        this.errorDetail.value = message.message
        this.fail('serverRejected')
        this.release()
      }
    }
    socket.onclose = () => {
      if (this.status.value === 'live' || this.status.value === 'starting') {
        this.fail('connectionLost')
        this.release()
      }
    }
    return socket
  }

  private startLevelMeter(analyser: AnalyserNode): void {
    const samples = new Float32Array(analyser.fftSize)
    this.levelTimer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) sum += sample * sample
      this.level.value = Math.min(1, Math.sqrt(sum / samples.length) * 4)
    }, 100)
  }

  private fail(code: CaptureErrorCode): void {
    this.errorCode.value = code
    this.status.value = 'error'
  }

  private release(): void {
    window.clearInterval(this.levelTimer)
    this.level.value = 0
    for (const stream of this.streams) for (const track of stream.getTracks()) track.stop()
    this.streams = []
    void this.context?.close()
    this.context = null
  }
}

class CaptureError extends Error {
  constructor(readonly code: CaptureErrorCode) {
    super(code)
  }
}

function classifyError(error: unknown): CaptureErrorCode {
  if (error instanceof CaptureError) return error.code
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return error.message.toLowerCase().includes('display')
      ? 'meetingAudioCancelled'
      : 'microphoneDenied'
  }
  return 'connectionLost'
}
