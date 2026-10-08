import { change } from "../lib/analysis";
import { useEffect, useRef, useState } from "react";
import { integer } from "../lib/numbers";
import type { Group, Summary } from "../types";
import { usePageCapacity } from "../lib/usePageCapacity";
import Dialog from "./Dialog";
const rate = (n: number, d: number) =>
  d > 0
    ? ((n / d) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 }) +
      "%"
    : "N/D";
function Trend({ summary }: { summary: Summary }) {
  const [expanded, setExpanded] = useState(false),
    [modalTab, setModalTab] = useState("values");
  const [metric, setMetric] = useState<
    "value" | "opens" | "clicks" | "bounces"
  >("value");
  const [selected, setSelected] = useState(0);
  const [style, setStyle] = useState("line");
  const names = {
    value: "Envíos",
    opens: "Aperturas únicas",
    clicks: "Clics únicos",
    bounces: "Rebotes",
  };
  useEffect(() => {
    const values = summary.trend.map((point) => point[metric] ?? -1);
    setSelected(Math.max(0, values.indexOf(Math.max(...values))));
  }, [summary.trend, metric]);
  const chart = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(760);
  const [height, setHeight] = useState(190);
  useEffect(() => {
    const update = () => {
      setWidth(Math.max(180, chart.current?.clientWidth || 760));
      setHeight(Math.max(60, chart.current?.clientHeight || 190));
    };
    update();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(update);
      if (chart.current) observer.observe(chart.current);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const { trend } = summary;
  const times = trend.map((point) =>
    Date.parse(point.label.length === 7 ? point.label + "-01" : point.label),
  );
  const first = times[0] || 0,
    span = (times[times.length - 1] || first) - first || 1;
  const max = Math.max(1, ...trend.map((point) => point[metric] || 0));
  const x = (i: number) => 46 + ((times[i] - first) / span) * (width - 64);
  const scaled = (value: number) =>
    style === "detail" ? Math.log1p(value) / Math.log1p(max) : value / max;
  const tick = (fraction: number) =>
    style === "detail"
      ? Math.expm1(Math.log1p(max) * fraction)
      : max * fraction;
  const y = (value: number) =>
    height - 26 - scaled(value) * Math.max(12, height - 42);
  let path = "",
    gap = true;
  for (let i = 0; i < trend.length; i++) {
    const value = trend[i][metric];
    if (value === null) {
      gap = true;
      continue;
    }
    path += `${gap ? "M" : "L"}${x(i).toFixed(2)},${y(value).toFixed(2)} `;
    gap = false;
  }
  const point = trend[Math.min(selected, trend.length - 1)];
  const dateLabel = (label: string) =>
    new Date(
      label.length === 7 ? label + "-01T00:00:00Z" : label + "T00:00:00Z",
    ).toLocaleDateString("es-CO", {
      timeZone: "UTC",
      month: "short",
      ...(label.length === 7
        ? { year: "numeric" }
        : { day: "numeric", year: "numeric" }),
    });
  const selectPoint = (clientX: number) => {
    const bounds = chart.current?.getBoundingClientRect();
    if (!bounds) return;
    const position = (clientX - bounds.left - 46) / (width - 64);
    const time = first + Math.max(0, Math.min(1, position)) * span;
    setSelected(
      times.reduce(
        (best, item, index) =>
          Math.abs(item - time) < Math.abs(times[best] - time) ? index : best,
        0,
      ),
    );
  };
  return (
    <div className="trend-explorer">
      <div className="trend-controls">
        <select
          aria-label="Métrica de evolución"
          value={metric}
          onChange={(event) => setMetric(event.target.value as typeof metric)}
        >
          {Object.entries(names).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Representación de evolución"
          value={style}
          onChange={(event) => setStyle(event.target.value)}
        >
          <option value="line">Línea</option>
          <option value="bars">Barras</option>
          <option value="detail">Línea · volúmenes pequeños</option>
        </select>
        <small>
          {trend[0]?.label.length === 7 ? "Por mes" : "Por día"} ·{" "}
          {summary.coverage.daysWithRecords} / {summary.coverage.calendarDays}{" "}
          días con datos
        </small>
      </div>
      <svg
        className="trend-svg"
        ref={chart}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        onPointerMove={(event) => selectPoint(event.clientX)}
        onPointerDown={(event) => selectPoint(event.clientX)}
        aria-label={`Evolución de ${names[metric]} entre ${summary.from} y ${summary.to}. ${style === "detail" ? "Escala logarítmica log(1 + volumen)." : "Escala lineal."} Los intervalos sin registros interrumpen la línea. Consulta cada período con el control inferior.`}
      >
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1="46"
              x2={width - 18}
              y1={y(tick(fraction))}
              y2={y(tick(fraction))}
              className="grid-line"
            />
            <text x="38" y={y(tick(fraction)) + 4} textAnchor="end">
              {new Intl.NumberFormat("es", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(tick(fraction))}
            </text>
          </g>
        ))}
        <path
          d={path}
          fill="none"
          stroke="var(--chart-line)"
          strokeWidth="3"
          strokeLinejoin="round"
          visibility={style !== "bars" ? "visible" : "hidden"}
        />
        {trend.map((point, i) =>
          point[metric] === null ? null : style === "bars" ? (
            <rect
              key={point.label}
              x={
                x(i) -
                Math.max(
                  1,
                  Math.min(
                    12,
                    ((width - 64) / Math.max(1, trend.length)) * 0.65,
                  ),
                ) /
                  2
              }
              y={y(point[metric]!)}
              width={Math.max(
                1,
                Math.min(12, ((width - 64) / Math.max(1, trend.length)) * 0.65),
              )}
              height={Math.max(1, y(0) - y(point[metric]!))}
              fill={selected === i ? "var(--chart-dot)" : "var(--chart-line)"}
            />
          ) : (
            <circle
              key={point.label}
              cx={x(i)}
              cy={y(point[metric]!)}
              r={selected === i ? "5" : "3"}
              fill="var(--chart-dot)"
            >
              <title>
                {point.label}: {integer(point[metric]!)} {names[metric]}
              </title>
            </circle>
          ),
        )}
        {[...new Set([0, Math.floor((trend.length - 1) / 2), trend.length - 1])]
          .filter((i) => i >= 0)
          .map((i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 4}
              textAnchor={
                i === 0 ? "start" : i === trend.length - 1 ? "end" : "middle"
              }
            >
              {dateLabel(trend[i]?.label)}
            </text>
          ))}
        {point && (
          <line
            className="selection-line"
            x1={x(Math.min(selected, trend.length - 1))}
            x2={x(Math.min(selected, trend.length - 1))}
            y1="14"
            y2={height - 26}
          />
        )}
      </svg>
      <div className="trend-inspector">
        <span>
          {point?.[metric] === max ? "↑ Pico · " : ""}
          {point ? dateLabel(point.label) : "Sin períodos"}
        </span>
        <strong>
          {point?.[metric] === null || !point
            ? "Sin registros"
            : integer(point[metric]!)}
        </strong>
        <small>
          {point?.value && metric !== "value"
            ? `${rate(point[metric] || 0, point.value)} de envíos`
            : point?.rows
              ? `${integer(point.rows)} registros`
              : ""}
        </small>
      </div>
      <input
        className="trend-cursor"
        type="range"
        min="0"
        max={Math.max(0, trend.length - 1)}
        value={Math.min(selected, Math.max(0, trend.length - 1))}
        disabled={!trend.length}
        aria-label="Período de la gráfica"
        aria-valuetext={
          point
            ? `${dateLabel(point.label)}: ${point[metric] === null ? "sin registros" : integer(point[metric]!) + " " + names[metric]}`
            : "Sin períodos"
        }
        onChange={(event) => setSelected(Number(event.target.value))}
      />
      <small className="trend-scale-note">
        {style === "detail"
          ? "Escala logarítmica log(1 + volumen): hace visibles valores pequeños."
          : "Escala lineal: altura proporcional al volumen."}{" "}
        Vacíos: sin registros.
      </small>
      <button
        className="compact-trend-button"
        onClick={() => {
          setExpanded(true);
          setModalTab("values");
        }}
      >
        Explorar gráfica · {point ? dateLabel(point.label) : "sin datos"} ↗
      </button>
      {expanded && (
        <Dialog
          title="Explorar evolución"
          className="trend-dialog"
          onClose={() => setExpanded(false)}
        >
          <div className="panel-tabs">
            <button
              aria-pressed={modalTab === "values"}
              onClick={() => setModalTab("values")}
            >
              Cifras por período
            </button>
            <button
              aria-pressed={modalTab === "options"}
              onClick={() => setModalTab("options")}
            >
              Métrica y escala
            </button>
          </div>
          {modalTab === "options" ? (
            <>
              <label>
                Métrica de evolución
                <select
                  aria-label="Métrica de evolución"
                  value={metric}
                  onChange={(event) =>
                    setMetric(event.target.value as typeof metric)
                  }
                >
                  {Object.entries(names).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Representación
                <select
                  aria-label="Representación de evolución"
                  value={style}
                  onChange={(event) => setStyle(event.target.value)}
                >
                  <option value="line">Línea</option>
                  <option value="bars">Barras</option>
                  <option value="detail">
                    Línea · volúmenes pequeños (logarítmica)
                  </option>
                </select>
              </label>
              <p>
                Escala lineal proporcional al volumen. La opción logarítmica
                permite comparar volúmenes pequeños sin ocultar el pico.
              </p>
            </>
          ) : (
            <>
              <div className="trend-inspector">
                <span>{point ? dateLabel(point.label) : "Sin períodos"}</span>
                <strong>
                  {point?.[metric] === null || !point
                    ? "Sin registros"
                    : integer(point[metric]!)}
                </strong>
              </div>
              <input
                className="trend-cursor"
                type="range"
                min="0"
                max={Math.max(0, trend.length - 1)}
                value={Math.min(selected, Math.max(0, trend.length - 1))}
                aria-label="Período de la gráfica"
                aria-valuetext={point ? dateLabel(point.label) : "Sin períodos"}
                disabled={!trend.length}
                onChange={(event) => setSelected(Number(event.target.value))}
              />
              <dl className="trend-values">
                {[
                  ["Envíos", point?.value],
                  ["Aperturas únicas", point?.opens],
                  ["Clics únicos", point?.clicks],
                  ["Rebotes", point?.bounces],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {value === null || value === undefined
                        ? "Sin registros"
                        : integer(Number(value))}
                    </dd>
                  </div>
                ))}
              </dl>
              <small>
                {summary.coverage.daysWithRecords} /{" "}
                {summary.coverage.calendarDays} días con registros; cobertura no
                certifica integridad.
              </small>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}
function Activity({ summary }: { summary: Summary }) {
  const total = summary.totals;
  return (
    <div
      className="activity-chart"
      role="img"
      aria-label="Actividad como porcentaje de envíos. Las categorías se solapan y no representan pasos de un embudo."
    >
      {[
        ["Entregados", total.delivered],
        ["Aperturas únicas", total.opens],
        ["Clics únicos", total.clicks],
        ["Rebotes", total.bounces],
      ].map(([label, count], index) => (
        <div className="activity-row" key={label}>
          <div>
            <span>{label}</span>
            <strong>
              {integer(Number(count))} · {rate(Number(count), total.sends)}
            </strong>
          </div>
          <span className={`activity-track tone-${index}`}>
            <span
              style={{
                width: `${total.sends ? Math.min(100, (Number(count) / total.sends) * 100) : 0}%`,
              }}
            />
          </span>
        </div>
      ))}
      <small>Tasas sobre envíos · las categorías se solapan</small>
    </div>
  );
}
function Distribution({
  title,
  groups,
  onSelect,
}: {
  title: string;
  groups: Group[];
  onSelect: (label: string) => void;
}) {
  const total = groups.reduce((sum, group) => sum + group.value, 0);
  return (
    <section className="glass distribution">
      <h2>{title}</h2>
      <div
        className="distribution-stack"
        role="img"
        aria-label={groups
          .map((group) => `${group.label}: ${rate(group.value, total)}`)
          .join("; ")}
      >
        {groups.map((group, index) => (
          <span
            className={`tone-${index}`}
            key={group.label}
            style={{ width: `${total ? (group.value / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="distribution-items">
        {groups.map((group, index) => (
          <button
            key={group.label}
            disabled={group.other}
            onClick={() => onSelect(group.label)}
            title={`${group.label}: ${integer(group.value)} envíos${group.other ? " · categorías restantes; consultar filtros" : ""}`}
          >
            <span className="distribution-name">
              <i className={`legend-dot tone-${index}`} />
              {group.label}
            </span>
            <strong>{rate(group.value, total)}</strong>
          </button>
        ))}
        {!groups.length && <p>Sin registros</p>}
      </div>
    </section>
  );
}
export default function Overview({
  summary,
  onCampaign,
  onFolder,
  onPurpose,
  onQuality,
}: {
  summary: Summary;
  onCampaign: (name: string) => void;
  onFolder: (name: string) => void;
  onPurpose: (name: string) => void;
  onQuality: () => void;
}) {
  const [chartTab, setChartTab] = useState("trend");
  const [activity, setActivity] = useState(false);
  const [rankSize, setRankSize] = useState(5),
    [rankPage, setRankPage] = useState(1);
  const ranking = usePageCapacity(rankSize, (size) => {
    setRankSize(Math.min(5, size));
    setRankPage(1);
  });
  const rankPages = Math.max(
    1,
    Math.ceil(summary.topCampaigns.length / rankSize),
  );
  useEffect(() => setRankPage(1), [summary]);
  const total = summary.totals,
    previous = summary.comparison?.totals;
  const definitions = [
    {
      label: "Envíos",
      value: integer(total.sends),
      help: `${integer(total.rows)} registros`,
      definition: "Suma de envíos de los registros seleccionados.",
      current: total.sends,
      prior: previous?.sends,
      rate: false,
    },
    {
      label: "Entrega",
      value: rate(total.delivered, total.sends),
      help: `${integer(total.delivered)} entregados`,
      definition:
        "Máximo entre envíos menos rebotes blandos y duros, y cero; dividido por envíos.",
      current: (total.delivered / total.sends) * 100,
      prior: previous && (previous.delivered / previous.sends) * 100,
      rate: true,
    },
    {
      label: "Aperturas / envíos",
      value: rate(total.opens, total.sends),
      help: `${integer(total.opens)} aperturas únicas`,
      definition:
        "Suma de aperturas únicas dividida por suma de envíos. No promedia tasas por fila.",
      current: (total.opens / total.sends) * 100,
      prior: previous && (previous.opens / previous.sends) * 100,
      rate: true,
    },
    {
      label: "Clics / envíos",
      value: rate(total.clicks, total.sends),
      help: `${integer(total.clicks)} clics únicos`,
      definition: "Suma de clics únicos dividida por suma de envíos.",
      current: (total.clicks / total.sends) * 100,
      prior: previous && (previous.clicks / previous.sends) * 100,
      rate: true,
    },
    {
      label: "Rebotes",
      value: rate(total.bounces, total.sends),
      help: `${integer(total.bounces)} · blandos + duros`,
      definition:
        "Suma de rebotes blandos y duros dividida por suma de envíos.",
      current: (total.bounces / total.sends) * 100,
      prior: previous && (previous.bounces / previous.sends) * 100,
      rate: true,
    },
  ];
  return (
    <div
      className="overview-layout"
      data-chart={chartTab}
      data-comparison={!!summary.comparison}
    >
      <section className="kpis" aria-label="Indicadores de rendimiento">
        {definitions.map((item) => (
          <article className="glass kpi" key={item.label}>
            <div className="kpi-label">
              <span className="value-full">{item.label}</span>
              <span className="value-compact">
                {item.label.replace(" / envíos", "")}
              </span>
              <span
                tabIndex={0}
                className="definition"
                aria-label={`${item.definition} ${item.help}.`}
              >
                ⓘ
                <span role="tooltip">
                  {item.definition} {item.help}.
                </span>
              </span>
            </div>
            <strong title={item.value} aria-label={item.value}>
              {item.label === "Envíos" ? (
                <>
                  <span className="value-full">{item.value}</span>
                  <span className="value-compact">
                    {new Intl.NumberFormat("es-CO", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(total.sends)}
                  </span>
                </>
              ) : (
                item.value
              )}
            </strong>
            <small title={item.help}>{item.help}</small>
            {summary.comparison && (
              <small className="comparison">
                {!previous?.rows ||
                (item.rate && (!previous.sends || !total.sends))
                  ? "No comparable"
                  : change(item.current, item.prior!, item.rate)}
              </small>
            )}
          </article>
        ))}
      </section>
      <div className="comparison-caption">
        {summary.comparison
          ? `Anterior: ${summary.comparison.from} al ${summary.comparison.to} · misma duración`
          : "Sin período anterior comparable"}
      </div>
      <div
        className="mobile-chart-tabs panel-tabs"
        aria-label="Gráficas del inventario"
      >
        {[
          ["trend", "Evolución"],
          ["activity", "Actividad"],
          ["ranking", "Top 5"],
          ["folders", "Folders"],
          ["purposes", "Propósitos"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={chartTab === key}
            onClick={() => setChartTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="main-charts">
        <section className="glass trend-card" data-activity={activity}>
          <div className="section-heading">
            <h2 className="trend-title">Evolución de actividad</h2>
            <h2 className="activity-title">Actividad sobre envíos</h2>
            <div className="chart-switch panel-tabs">
              <button
                aria-pressed={!activity}
                onClick={() => setActivity(false)}
              >
                Evolución
              </button>
              <button aria-pressed={activity} onClick={() => setActivity(true)}>
                Actividad
              </button>
            </div>
          </div>
          <div className="trend-plot" data-active={!activity}>
            <Trend summary={summary} />
          </div>
          <div className="activity-plot" data-active={activity}>
            <Activity summary={summary} />
          </div>
        </section>
        <section className="glass ranking">
          <div className="section-heading">
            <h2>Top 5 campañas</h2>
            <span>Por envíos</span>
          </div>
          <div className="rank-list" ref={ranking}>
            <ol start={(rankPage - 1) * rankSize + 1}>
              {summary.topCampaigns
                .slice((rankPage - 1) * rankSize, rankPage * rankSize)
                .map((group) => (
                  <li key={group.label}>
                    <button
                      onClick={() => onCampaign(group.label)}
                      title={group.label}
                    >
                      <span
                        className="rank-fill"
                        style={{
                          width: `${summary.topCampaigns[0]?.value ? (group.value / summary.topCampaigns[0].value) * 100 : 0}%`,
                        }}
                      />
                      <span className="rank-name">{group.label}</span>
                      <strong>{integer(group.value)}</strong>
                    </button>
                  </li>
                ))}
            </ol>
          </div>
          {rankPages > 1 && (
            <div className="rank-pager">
              <button
                aria-label="Ranking anterior"
                disabled={rankPage === 1}
                onClick={() => setRankPage(rankPage - 1)}
              >
                ←
              </button>
              <small>
                {rankPage} / {rankPages}
              </small>
              <button
                aria-label="Ranking siguiente"
                disabled={rankPage >= rankPages}
                onClick={() => setRankPage(rankPage + 1)}
              >
                →
              </button>
            </div>
          )}
          {!summary.topCampaigns.length && (
            <p>Sin registros en este período.</p>
          )}
        </section>
      </div>
      <div className="distributions">
        <Distribution
          title="Distribución por folder"
          groups={summary.folders}
          onSelect={onFolder}
        />
        <Distribution
          title="Distribución por propósito"
          groups={summary.purposes}
          onSelect={onPurpose}
        />
      </div>
      <button className="quality-notice" onClick={onQuality}>
        <span>
          ⓘ {integer(summary.quality.anomalyRows)} registros con incidencias
        </span>
        <span>Revisar calidad ↗</span>
      </button>
    </div>
  );
}
