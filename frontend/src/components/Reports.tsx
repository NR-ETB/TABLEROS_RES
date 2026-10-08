import { useState } from "react";
import type { Filters, OverviewData, ReportFormat } from "../types";
import { defaultFilters, periodDates } from "../lib/analysis";
import { exportReport } from "../lib/client";
import { rangeError } from "../lib/reports";
import { saveDownload } from "../lib/download";
import { integer } from "../lib/numbers";
import Dialog from "./Dialog";

const formats: Record<ReportFormat, string> = {
  campaigns: "Campañas · CSV para Excel",
  days: "Evolución diaria · CSV para Excel",
  records: "Registros completos · CSV para Excel",
  quality: "Incidencias · CSV para Excel",
  html: "Informe imprimible · HTML",
};
export default function Reports({
  overview,
  filters,
  issue,
  onClose,
}: {
  overview: OverviewData;
  filters: Filters;
  issue?: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState("dates");
  const [from, setFrom] = useState(filters.from),
    [to, setTo] = useState(filters.to);
  const [keepFilters, setKeepFilters] = useState(true);
  const [format, setFormat] = useState<ReportFormat>("campaigns");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const quick = (period: "all" | "last30" | "last90") => {
    const dates = periodDates(overview.meta, period);
    setFrom(dates[0]);
    setTo(dates[1]);
    setError("");
    setMessage("");
  };
  const submit = async () => {
    const invalid = rangeError(from, to);
    if (invalid) {
      setError(invalid);
      setStep("dates");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const selection = {
        ...(keepFilters ? filters : defaultFilters(overview.meta)),
        from,
        to,
        period: "custom" as const,
      };
      const result = await exportReport(overview, {
        filters: selection,
        format,
        issue: keepFilters ? issue : undefined,
      });
      const html = format === "html";
      saveDownload(
        result.content,
        `etb-responsys-${format}-${from}_${to}.${html ? "html" : "csv"}`,
        html ? "text/html;charset=utf-8" : "text/csv;charset=utf-8",
      );
      setMessage(
        `Descargado · ${integer(result.rowCount)} registros. ${result.rowCount ? "" : "La selección no tiene registros."}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      if (cause instanceof Error && cause.message === "DATA_CHANGED")
        setError(
          "La fuente cambió. Recarga el tablero antes de generar el reporte.",
        );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="Reportes por fecha"
      onClose={onClose}
      className="report-dialog"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (step === "dates") {
            const invalid = rangeError(from, to);
            if (invalid) setError(invalid);
            else {
              setError("");
              setStep("format");
            }
          } else void submit();
        }}
      >
        <div className="panel-tabs report-steps" aria-label="Pasos del reporte">
          <button
            type="button"
            aria-pressed={step === "dates"}
            onClick={() => setStep("dates")}
          >
            1 · Fechas
          </button>
          <button
            type="button"
            aria-pressed={step === "format"}
            onClick={() => {
              const invalid = rangeError(from, to);
              if (invalid) setError(invalid);
              else {
                setError("");
                setStep("format");
              }
            }}
          >
            2 · Descargar
          </button>
        </div>
        <div hidden={step !== "dates"} className="report-step">
          <div className="filter-grid">
            <label>
              Desde
              <input
                type="date"
                onInput={(event) => {
                  const value = event.currentTarget.value;
                  setFrom(value);
                  setMessage("");
                }}
                name="reportFrom"
                value={from}
                max={to}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setMessage("");
                }}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                onInput={(event) => {
                  const value = event.currentTarget.value;
                  setTo(value);
                  setMessage("");
                }}
                name="reportTo"
                value={to}
                min={from}
                onChange={(e) => {
                  setTo(e.target.value);
                  setMessage("");
                }}
              />
            </label>
          </div>
          <div className="report-quick" aria-label="Rangos de reporte">
            <button type="button" onClick={() => quick("all")}>
              Histórico
            </button>
            <button type="button" onClick={() => quick("last30")}>
              30 días
            </button>
            <button type="button" onClick={() => quick("last90")}>
              90 días
            </button>
          </div>
          <label className="check-field">
            <input
              type="checkbox"
              checked={keepFilters}
              onChange={(e) => setKeepFilters(e.target.checked)}
            />
            Usar los filtros actuales
          </label>
        </div>
        <div hidden={step !== "format"} className="report-step">
          <p className="report-range">
            {from} → {to}
            <small>
              {keepFilters
                ? "Con filtros actuales"
                : "Fuente completa dentro del rango"}
            </small>
          </p>
          <label className="report-format">
            Contenido y formato
            <select
              value={format}
              onChange={(e) => {
                setFormat(e.target.value as ReportFormat);
                setMessage("");
              }}
            >
              {Object.entries(formats).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="filter-note">
            {format === "html"
              ? "Resumen, campañas y procedencia. Ábrelo para imprimir o guardar como PDF."
              : "Todas las filas de la selección. Archivo con separador punto y coma y codificación UTF-8."}
          </p>
        </div>
        <p className="filter-note" role={error ? "alert" : "status"}>
          {error ||
            message ||
            "Fechas inclusivas. Registros sin fecha excluidos. No cambia los filtros del tablero."}
        </p>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy
              ? "Preparando…"
              : step === "dates"
                ? "Continuar"
                : "Descargar"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
