/* global AudioWorkletProcessor, registerProcessor */
// This side branch outputs silence. The audible path never passes through the meter.
class LevelMeterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.peaks = [0, 0];
    this.running = true;
    this.port.onmessage = (event) => {
      if (event.data === "stop") {
        this.running = false;
        return;
      }
      this.port.postMessage(this.peaks);
      this.peaks = [0, 0];
    };
  }

  process(inputs) {
    if (!this.running) return false;
    const channels = inputs[0];
    for (let channel = 0; channel < 2; channel++) {
      const samples = channels?.[channel] ?? channels?.[0];
      if (!samples) continue;
      let peak = this.peaks[channel];
      for (let index = 0; index < samples.length; index++) {
        peak = Math.max(peak, Math.abs(samples[index]));
      }
      this.peaks[channel] = peak;
    }
    return true;
  }
}
registerProcessor("playhead-level-meter", LevelMeterProcessor);
