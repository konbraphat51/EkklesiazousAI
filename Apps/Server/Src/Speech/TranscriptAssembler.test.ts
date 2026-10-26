// Tests for TranscriptAssembler segmentation, captions and language detection.
import { describe, expect, it } from 'vitest'
import type { CaptionLive, TranscriptSegment } from '@ekklesiazous/shared'
import { TranscriptAssembler } from './TranscriptAssembler'
import type { RecognizedToken } from './SpeechRecognizer'

function token(
  text: string,
  speaker: string | null,
  language: 'en' | 'ja' = 'en',
  startMs = 0,
): RecognizedToken {
  return { text, startMs, endMs: startMs + 100, speaker, language }
}

function createAssembler(clock = { now: 0 }): {
  assembler: TranscriptAssembler
  segments: TranscriptSegment[]
  captions: Array<CaptionLive | null>
} {
  const segments: TranscriptSegment[] = []
  const captions: Array<CaptionLive | null> = []
  const assembler = new TranscriptAssembler(
    {
      sourceId: 'mic',
      streamOffsetMs: 1000,
      resolveSpeakerId: (label) => `mic:${label ?? '?'}`,
      now: () => clock.now,
    },
    {
      onSegment: (segment) => segments.push(segment),
      onCaption: (caption) => captions.push(caption),
    },
  )
  return { assembler, segments, captions }
}

describe('TranscriptAssembler', () => {
  it('emits a segment on endpoint and shows interim text as caption', () => {
    const { assembler, segments, captions } = createAssembler()
    assembler.accept({
      tokensFinal: [token('Hello', '1')],
      tokensInterim: [token(' wor', '1')],
      isEndpoint: false,
    })
    expect(captions.at(-1)?.text).toBe('Hello wor')
    assembler.accept({
      tokensFinal: [token(' world', '1', 'en', 200)],
      tokensInterim: [],
      isEndpoint: true,
    })
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({
      text: 'Hello world',
      speakerId: 'mic:1',
      startMs: 1000,
      endMs: 1300,
    })
    expect(captions.at(-1)).toBeNull()
  })

  it('splits segments when the speaker changes', () => {
    const { assembler, segments } = createAssembler()
    assembler.accept({
      tokensFinal: [token('そうですね', '1', 'ja'), token('I agree', '2')],
      tokensInterim: [],
      isEndpoint: true,
    })
    expect(segments.map((segment) => [segment.speakerId, segment.text, segment.language])).toEqual([
      ['mic:1', 'そうですね', 'ja'],
      ['mic:2', 'I agree', 'en'],
    ])
  })

  it('flushes idle speech and long sentences', () => {
    const clock = { now: 0 }
    const { assembler, segments } = createAssembler(clock)
    assembler.accept({ tokensFinal: [token('pending', '1')], tokensInterim: [], isEndpoint: false })
    clock.now = 1000
    assembler.flushIfIdle()
    expect(segments).toHaveLength(0)
    clock.now = 2000
    assembler.flushIfIdle()
    expect(segments).toHaveLength(1)

    const longSentence = `${'word '.repeat(40)}end.`
    assembler.accept({
      tokensFinal: [token(longSentence, '1')],
      tokensInterim: [],
      isEndpoint: false,
    })
    expect(segments).toHaveLength(2)
  })

  it('picks the language covering most characters', () => {
    const { assembler, segments } = createAssembler()
    assembler.accept({
      tokensFinal: [token('LLMの', '1', 'en'), token('レイテンシを下げたい', '1', 'ja')],
      tokensInterim: [],
      isEndpoint: true,
    })
    expect(segments[0]?.language).toBe('ja')
  })
})
