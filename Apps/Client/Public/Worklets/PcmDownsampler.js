// AudioWorklet that mixes input channels, downsamples to 16 kHz and emits 40 ms PCM16 frames.
const TARGET_RATE = 16000
const FRAME_SAMPLES = 640

class PcmDownsampler extends AudioWorkletProcessor {
  constructor() {
    super()
    this.ratio = sampleRate / TARGET_RATE
    this.frame = new Int16Array(FRAME_SAMPLES)
    this.index = 0
    this.position = 0
    this.sum = 0
    this.count = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const length = input[0].length
    for (let sampleIndex = 0; sampleIndex < length; sampleIndex++) {
      // average channels, then average samples within each output period (box low-pass)
      let mixed = 0
      for (let channel = 0; channel < input.length; channel++) mixed += input[channel][sampleIndex]
      this.sum += mixed / input.length
      this.count += 1
      this.position += 1
      if (this.position < this.ratio) continue
      this.position -= this.ratio
      const value = Math.max(-1, Math.min(1, this.sum / this.count))
      this.sum = 0
      this.count = 0
      this.frame[this.index++] = value < 0 ? value * 0x8000 : value * 0x7fff
      if (this.index === FRAME_SAMPLES) {
        this.port.postMessage(this.frame.buffer, [this.frame.buffer])
        this.frame = new Int16Array(FRAME_SAMPLES)
        this.index = 0
      }
    }
    return true
  }
}

registerProcessor('pcm-downsampler', PcmDownsampler)
