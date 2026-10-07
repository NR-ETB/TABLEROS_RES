import { useLayoutEffect, useRef } from "react";

// The list gets the remaining viewport space. Pagination, rather than scrolling,
// keeps every row reachable when the window or browser zoom changes.
export function usePageCapacity(
  pageSize: number,
  onCapacity?: (size: number) => void,
) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onCapacity);
  callback.current = onCapacity;
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !callback.current) return;
    const update = () => {
      const header =
        element.querySelector("thead")?.getBoundingClientRect().height || 0;
      const rowHeight =
        Number.parseFloat(
          getComputedStyle(element).getPropertyValue("--row-height"),
        ) || 56;
      const capacity = Math.max(
        1,
        Math.min(
          25,
          Math.floor((element.clientHeight - header - 2) / rowHeight),
        ),
      );
      if (capacity !== pageSize) callback.current?.(capacity);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [pageSize, !!onCapacity]);
  return ref;
}
