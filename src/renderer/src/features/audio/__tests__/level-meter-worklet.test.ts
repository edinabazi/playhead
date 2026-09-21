import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import processorSource from "../level-meter.worklet.js?raw";

function createProcessor() {
  type Processor = {
    port: { onmessage: (event: { data: unknown }) => void; postMessage: ReturnType<typeof vi.fn> };
    process: (inputs: Float32Array[][]) => boolean;
  };
  let ProcessorClass: new () => Processor;
  runInNewContext(processorSource, {
    AudioWorkletProcessor: class {
      port = { onmessage: null, postMessage: vi.fn() };
    },
    registerProcessor: (_name: string, constructor: new () => Processor) => {
      ProcessorClass = constructor;
    },
  });
  return new ProcessorClass!();
}

describe("continuous level capture", () => {
  it.each([44100, 48000, 96000, 192000])(
    "retains a one-sample peak across a delayed UI read at %i Hz",
    (rate) => {
      const processor = createProcessor();
      const left = new Float32Array(128);
      left[0] = 0.75;
      const right = new Float32Array(128);
      right[127] = -0.25;
      processor.process([[left, right]]);
      for (let sample = 0; sample < rate * 0.3; sample += 128) {
        processor.process([[new Float32Array(128), new Float32Array(128)]]);
      }
      processor.port.onmessage({ data: null });
      expect(processor.port.postMessage).toHaveBeenLastCalledWith([0.75, 0.25]);
      processor.port.onmessage({ data: null });
      expect(processor.port.postMessage).toHaveBeenLastCalledWith([0, 0]);
    },
  );

  it("duplicates mono into both channels and stops processing when detached", () => {
    const processor = createProcessor();
    processor.process([[new Float32Array([-0.5, 0.25])]]);
    processor.port.onmessage({ data: null });
    expect(processor.port.postMessage).toHaveBeenLastCalledWith([0.5, 0.5]);
    processor.port.onmessage({ data: "stop" });
    expect(processor.process([[]])).toBe(false);
  });
});
