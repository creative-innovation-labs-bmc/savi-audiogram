// One audio time drives every bar. Spatial weights never move along the canvas.
// Precomputation makes seeks, preview and export reproduce the same frame.
export function analyseEnvelope(channels, sampleRate, fps = 60) {
  if (!channels.length || !channels[0].length) return new Float32Array();
  const length = channels[0].length;
  const count = Math.ceil(length / sampleRate * fps);
  const levels = new Float32Array(count);
  let peak = 0;
  for (let frame = 0; frame < count; frame++) {
    const begin = Math.floor(frame * sampleRate / fps);
    const end = Math.min(length, Math.floor((frame + 1) * sampleRate / fps));
    let energy = 0;
    for (const samples of channels) {
      for (let i = begin; i < end; i++) energy += samples[i] * samples[i];
    }
    const rms = Math.sqrt(energy / Math.max(1, (end - begin) * channels.length));
    levels[frame] = rms;
    peak = Math.max(peak, rms);
  }
  // Keep near-silent recordings quiet rather than amplifying their noise to full scale.
  const scale = Math.max(peak, 0.05);
  const attack = 1 - Math.exp(-1 / (fps * 0.035));
  const release = 1 - Math.exp(-1 / (fps * 0.16));
  let smoothed = 0;
  for (let i = 0; i < levels.length; i++) {
    const target = levels[i] < 0.0005 ? 0 : Math.min(1, levels[i] / scale);
    smoothed += (target - smoothed) * (target > smoothed ? attack : release);
    levels[i] = smoothed;
  }
  return levels;
}
export function verticalBarLevels(envelope, time, count, fps = 60) {
  const at = Math.max(0, Math.min(envelope.length - 1, time * fps));
  const i = Math.floor(at), fraction = at - i;
  const level = envelope.length ? (envelope[i] || 0) * (1 - fraction) + (envelope[Math.min(i + 1, envelope.length - 1)] || 0) * fraction : 0;
  const amplitude = Math.pow(Math.max(0, level), 0.6);
  return Array.from({length: count}, (_, bar) => {
    const x = count > 1 ? bar / (count - 1) : 0.5;
    // A broad, gently curved top and fixed baseline match the SAVI reference style.
    const profile = 0.86 + 0.09 * Math.cos(2 * Math.PI * x) + 0.05 * Math.cos(4 * Math.PI * x);
    return amplitude * profile;
  });
}
