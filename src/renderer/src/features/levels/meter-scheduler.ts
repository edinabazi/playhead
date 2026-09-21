type FrameScheduler = {
  requestFrame: (callback: (time: number) => void) => number;
  cancelFrame: (id: number) => void;
  setTimer: (callback: () => void, delay: number) => number;
  clearTimer: (id: number) => void;
};

const browserScheduler: FrameScheduler = {
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  setTimer: (callback, delay) => window.setTimeout(callback, delay),
  clearTimer: (id) => window.clearTimeout(id),
};

export function scheduleMeterFrames(
  draw: (time: number) => boolean,
  intervalMs: number,
  scheduler: FrameScheduler = browserScheduler,
): () => void {
  let frame = 0;
  let timer = 0;
  let stopped = false;
  let deadline = -Infinity;
  const queue = (delay: number) => {
    timer = scheduler.setTimer(() => {
      frame = scheduler.requestFrame(tick);
    }, delay);
  };
  const tick = (time: number) => {
    if (stopped) return;
    if (time < deadline) {
      queue(deadline - time);
      return;
    }
    if (!draw(time)) return;
    deadline = time + intervalMs;
    queue(intervalMs);
  };
  frame = scheduler.requestFrame(tick);
  return () => {
    stopped = true;
    scheduler.clearTimer(timer);
    scheduler.cancelFrame(frame);
  };
}
