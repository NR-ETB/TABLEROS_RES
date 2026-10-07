import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
export default function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const shell = document.querySelector<HTMLElement>(".app-shell");
    const wasInert = shell?.inert || false;
    const parent = [
      ...document.querySelectorAll<HTMLElement>('[role="dialog"]'),
    ]
      .filter((element) => element !== panel.current)
      .at(-1);
    const parentWasInert = parent?.inert || false;
    if (parent) parent.inert = true;
    if (shell) shell.inert = true;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const handle = (event: KeyboardEvent) => {
      if (
        [...document.querySelectorAll('[role="dialog"]')].at(-1) !==
        panel.current
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = [
        ...(panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
        ) || []),
      ].filter((element) => element.getClientRects().length);
      const first = elements[0],
        last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        panel.current?.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = overflow;
      if (shell) shell.inert = wasInert;
      if (parent) parent.inert = parentWasInert;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`glass dialog ${wide ? "wide" : ""}`}
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button aria-label="Cerrar panel" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dialog-content">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
