import { useEffect, useRef, useState } from "react";
import { Pager } from "./Records";

// All source fields remain reachable, including long subjects, without scrolling.
export default function FieldPages({
  fields,
}: {
  fields: Record<string, unknown>;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(2),
    [page, setPage] = useState(1);
  const entries = Object.entries(fields).flatMap(([key, value]) => {
    const text = value === null || value === "" ? "Sin dato" : String(value);
    const parts = text.match(/.{1,140}/gsu) || ["Sin dato"];
    return parts.map((part, index) => [
      parts.length > 1 ? `${key} (${index + 1}/${parts.length})` : key,
      part,
    ]);
  });
  useEffect(() => setPage(1), [fields]);
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const columns = element.clientWidth > 620 ? 2 : 1;
      setSize(
        Math.max(
          1,
          Math.min(6, Math.floor(element.clientHeight / 108) * columns),
        ),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const current = Math.min(page, Math.max(1, Math.ceil(entries.length / size)));
  return (
    <div className="field-pages">
      <div ref={area} className="field-page-area">
        <dl className="field-page-grid">
          {entries
            .slice((current - 1) * size, current * size)
            .map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
      </div>
      <Pager
        page={current}
        count={entries.length}
        pageSize={size}
        onChange={setPage}
      />
    </div>
  );
}
