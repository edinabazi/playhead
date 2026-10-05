import { useCallback, useEffect, useMemo, useState } from "react";

export type VirtualRow = {
  index: number;
  start: number;
};

export function useVirtualList({
  itemCount,
  itemHeight,
  overscan = 8,
}: {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    if (!container) return;

    const updateSize = () => setViewportHeight(container.clientHeight);
    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [container]);

  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const scrollToOffset = useCallback(
    (offset: number) => {
      const nextScrollTop = Math.max(0, offset);
      setScrollTop(nextScrollTop);
      if (container) container.scrollTop = nextScrollTop;
    },
    [container],
  );

  const rows = useMemo<VirtualRow[]>(() => {
    if (itemCount === 0 || viewportHeight === 0) return [];

    const startIndex = Math.min(
      itemCount - 1,
      Math.max(0, Math.floor(scrollTop / itemHeight) - overscan),
    );
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan,
    );

    return Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
      const index = startIndex + offset;
      return { index, start: index * itemHeight };
    });
  }, [itemCount, itemHeight, overscan, scrollTop, viewportHeight]);

  const scrollToIndex = useCallback(
    (index: number, align: "center" | "nearest" = "center") => {
      if (!container || index < 0 || index >= itemCount) return;

      const itemTop = index * itemHeight;
      const itemBottom = itemTop + itemHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;

      if (align === "nearest" && itemTop >= viewTop && itemBottom <= viewBottom) return;

      const offset =
        align === "center"
          ? itemTop - (container.clientHeight - itemHeight) / 2
          : itemTop < viewTop
            ? itemTop
            : itemBottom - container.clientHeight;
      const nextScrollTop = Math.max(
        0,
        Math.min(offset, itemCount * itemHeight - container.clientHeight),
      );
      setScrollTop(nextScrollTop);
      container.scrollTop = nextScrollTop;
    },
    [container, itemCount, itemHeight],
  );

  return {
    container,
    containerRef: setContainer,
    onScroll,
    rows,
    scrollTop,
    totalHeight: itemCount * itemHeight,
    scrollToIndex,
    scrollToOffset,
  };
}
