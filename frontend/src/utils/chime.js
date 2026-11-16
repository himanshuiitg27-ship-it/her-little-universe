/** Soft two-note chime generated with WebAudio (no audio files needed). */
export function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 1)
    })
    setTimeout(() => ctx.close(), 1800)
  } catch {
    /* audio blocked: silently ignore */
  }
}
