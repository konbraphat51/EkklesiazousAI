// Captures microphone and/or online-meeting audio (tab or system), converts each to 16 kHz PCM16 and
// streams them to the server as separate channels (so the host's own voice keeps the host's name).
import { shallowRef, type ShallowRef } from 'vue'
import type { AudioMessageServer, CaptureMode, MeetingPlatform } from '@ekklesiazous/shared'

/** Capture lifecycle. */
export type CaptureStatus = 'idle' | 'starting' | 'live' | 'error'

/** One audio channel sent to the server. */
export interface CaptureChannel {
  /** `meeting`: the online meeting's tab/system audio; `microphone`: a local microphone. */
  kind: 'meeting' | 'microphone'
  /** Capture mode announced to the server (decides diarization). */
  captureMode: CaptureMode
  /** Stream id unique within the room. */
  sourceId: string
  /** Known speaker for single-speaker channels; null to diarize. */
  speakerName: string | null
}

/** What to capture. */
export interface AudioCaptureOptions {
  /** Target room. */
  roomId: string
  /** Meeting platform (tunes the screen-share picker). */
  meetingPlatform: MeetingPlatform
  /** Channels to open. */
  channels: CaptureChannel[]
  /** Microphone device, or '' for the default. */
  microphoneDeviceId: string
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

/**
 * Builds the channels of a capture mode.
 *
 * @param captureMode - Room capture mode.
 * @param participantId - Pseudonymous id (makes source ids unique).
 * @param ownName - Display name used for the own-microphone channel.
 */
export function planCaptureChannels(
  captureMode: CaptureMode,
  participantId: string,
  ownName: string,
): CaptureChannel[] {
  const suffix = participantId.slice(0, 8)
  const ownMicrophone: CaptureChannel = {
    kind: 'microphone',
    captureMode: 'onlinePerParticipant',
    sourceId: `mic:${suffix}`,
    speakerName: ownName || null,
  }
  if (captureMode === 'roomMicrophone') {
    return [{ kind: 'microphone', captureMode, sourceId: `room:${suffix}`, speakerName: null }]
  }
  if (captureMode === 'onlineHostCapture') {
    // remote voices are diarized from the meeting tab; the host speaks on a named channel
    return [
      { kind: 'meeting', captureMode, sourceId: `meeting:${suffix}`, speakerName: null },
      ownName ? ownMicrophone : { ...ownMicrophone, captureMode, speakerName: null },
    ]
  }
  if (captureMode === 'onlinePerParticipant') return [ownMicrophone]
  return []
}

/** One active capture session (possibly several channels). */
export class AudioCapture {
  /** Lifecycle status. */
  readonly status: ShallowRef<CaptureStatus> = shallowRef('idle')
  /** Combined input level 0..1 for the meter. */
  readonly level: ShallowRef<number> = shallowRef(0)
  /** Error code when status is `error`. */
  readonly errorCode: ShallowRef<CaptureErrorCode | null> = shallowRef(null)
  /** Server-side error detail, if any. */
  readonly errorDetail: ShallowRef<string> = shallowRef('')
  /** Recognizer reported by the server. */
  readonly recognizer: ShallowRef<string> = shallowRef('')
  private context: AudioContext | null = null
  private streams: MediaStream[] = []
  private sockets: WebSocket[] = []
  private levelTimer = 0

  /**
   * Starts capturing and streaming every channel.
   *
   * @param options - What to capture.
   */
  async start(options: AudioCaptureOptions): Promise<void> {
    this.stop()
    this.status.value = 'starting'
    this.errorCode.value = null
    this.errorDetail.value = ''
    try {
      const context = new AudioContext()
      this.context = context
      await context.audioWorklet.addModule('/Worklets/PcmDownsampler.js')
      const meter = context.createGain()
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      meter.connect(analyser)
      let readyCount = 0

      for (const channel of options.channels) {
        const stream = await this.acquire(channel, options)
        this.streams.push(stream)
        const source = context.createMediaStreamSource(stream)
        const worklet = new AudioWorkletNode(context, 'pcm-downsampler')
        source.connect(worklet)
        source.connect(meter)
        const socket = this.openSocket(options.roomId, channel, options.languageHints, () => {
          readyCount += 1
          if (readyCount === options.channels.length) this.status.value = 'live'
        })
        this.sockets.push(socket)
        worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
          if (socket.readyState === WebSocket.OPEN) socket.send(event.data)
        }
      }
      this.startLevelMeter(analyser)
    } catch (error) {
      this.fail(classifyError(error))
      this.release()
    }
  }

  /** Stops capturing and closes every channel. */
  stop(): void {
    for (const socket of this.sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'stop' }))
      socket.close()
    }
    this.sockets = []
    this.release()
    if (this.status.value !== 'error') this.status.value = 'idle'
  }

  private async acquire(
    channel: CaptureChannel,
    options: AudioCaptureOptions,
  ): Promise<MediaStream> {
    if (channel.kind === 'meeting') {
      // Google Meet always runs in a tab; desktop clients (Zoom, Teams) need system audio
      const isTabOnly = options.meetingPlatform === 'googleMeet'
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: isTabOnly ? { displaySurface: 'browser', frameRate: 1 } : { frameRate: 1 },
        audio: {
          suppressLocalAudioPlayback: false,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as MediaTrackConstraints,
        selfBrowserSurface: 'exclude',
        systemAudio: isTabOnly ? 'exclude' : 'include',
      } as DisplayMediaStreamOptions)
      if (display.getAudioTracks().length === 0) {
        for (const track of display.getTracks()) track.stop()
        throw new CaptureError('meetingAudioMissing')
      }
      // video is kept alive at 1 fps: stopping it can end the shared audio in some browsers
      return display
    }
    // a room microphone must hear everyone: no echo cancellation, suppression or gain control
    const isRoom = channel.captureMode === 'roomMicrophone'
    return navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: options.microphoneDeviceId ? { exact: options.microphoneDeviceId } : undefined,
        echoCancellation: !isRoom,
        noiseSuppression: !isRoom,
        autoGainControl: !isRoom,
        channelCount: 1,
      },
    })
  }

  private openSocket(
    roomId: string,
    channel: CaptureChannel,
    languageHints: string[],
    onReady: () => void,
  ): WebSocket {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${scheme}://${window.location.host}/ws/audio/${roomId}`)
    socket.binaryType = 'arraybuffer'
    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'start',
          sourceId: channel.sourceId,
          captureMode: channel.captureMode,
          speakerName: channel.speakerName,
          languageHints,
        }),
      )
    }
    socket.onmessage = (event: MessageEvent<string>) => {
      const message = JSON.parse(event.data) as AudioMessageServer
      if (message.type === 'ready') {
        this.recognizer.value = message.recognizer
        onReady()
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
