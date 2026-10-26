// Tests for capture channel planning per capture mode.
import { describe, expect, it } from 'vitest'
import { planCaptureChannels } from './AudioCapture'

describe('planCaptureChannels', () => {
  it('diarizes a single room microphone', () => {
    expect(planCaptureChannels('roomMicrophone', 'abcdef123456', 'Aiko')).toEqual([
      {
        kind: 'microphone',
        captureMode: 'roomMicrophone',
        sourceId: 'room:abcdef12',
        speakerName: null,
      },
    ])
  })

  it('splits host capture into a diarized meeting channel and a named microphone', () => {
    const channels = planCaptureChannels('onlineHostCapture', 'abcdef123456', 'Aiko')
    expect(
      channels.map((channel) => [channel.kind, channel.captureMode, channel.speakerName]),
    ).toEqual([
      ['meeting', 'onlineHostCapture', null],
      ['microphone', 'onlinePerParticipant', 'Aiko'],
    ])
  })

  it('diarizes the host microphone too when the host has no name', () => {
    const channels = planCaptureChannels('onlineHostCapture', 'abcdef123456', '')
    expect(channels[1]).toMatchObject({ captureMode: 'onlineHostCapture', speakerName: null })
  })

  it('opens nothing for server-side capture modes', () => {
    expect(planCaptureChannels('zoomRtms', 'abcdef123456', 'Aiko')).toEqual([])
    expect(planCaptureChannels('demo', 'abcdef123456', 'Aiko')).toEqual([])
  })
})
