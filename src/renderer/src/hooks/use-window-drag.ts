import { useRef } from "react";

type WindowDragState = {
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startWindowX: number;
  startWindowY: number;
};

export function useWindowDrag<TElement extends HTMLElement>() {
  const windowDragRef = useRef<WindowDragState | null>(null);

  const onPointerDown = (event: React.PointerEvent<TElement>) => {
    if (event.button !== 0) return;
    if ((event.target as Element | null)?.closest(".no-drag")) return;

    windowDragRef.current = {
      pointerId: event.pointerId,
      startPointerX: event.screenX,
      startPointerY: event.screenY,
      startWindowX: window.screenX,
      startWindowY: window.screenY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent<TElement>) => {
    const drag = windowDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const nextX = drag.startWindowX + event.screenX - drag.startPointerX;
    const nextY = drag.startWindowY + event.screenY - drag.startPointerY;
    void window.playhead.moveWindowTo(nextX, nextY);
  };

  const onPointerUp = (event: React.PointerEvent<TElement>) => {
    if (windowDragRef.current?.pointerId !== event.pointerId) return;
    windowDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };
}
