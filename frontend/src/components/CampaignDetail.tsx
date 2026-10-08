import { useMemo, useState } from "react";
import type { Query, QueryResult } from "../types";
import FieldPages from "./FieldPages";
import Records, { Pager } from "./Records";
import { integer, pct } from "../lib/numbers";
// Intent: trace a campaign from counts to original source. Shared ETB palette,
// border depth, quiet surfaces, Segoe UI, 8/16 px spacing and 44 px tabs.
export default function CampaignDetail({
  result,
  request,
  onRequest,
}: {
  result: QueryResult;
  request: Query;
  onRequest: (next: Partial<Query>) => void;
}) {
  const [tab, setTab] = useState("resumen"),
    [entry, setEntry] = useState(0);
  const info = useMemo(
    () => ({
      "Campaña original": request.selected,
      "Registros del corte": result.detail?.rows,
      "Primera fecha": result.campaignInfo?.from,
      "Última fecha": result.campaignInfo?.to,
      Folders: result.campaignInfo?.folders.join(" · "),
      Propósitos: result.campaignInfo?.purposes.join(" · "),
      Programas: result.campaignInfo?.programs.join(" · "),
      Listas: result.campaignInfo?.lists.join(" · "),
      Tipos: result.campaignInfo?.types.join(" · "),
      Estados: result.campaignInfo?.statuses.join(" · "),
    }),
    [result.campaignInfo, result.detail?.rows, request.selected],
  );
  const total = result.detail!;
  return (
    <>
      <div className="panel-tabs" aria-label="Detalle de campaña">
        {[
          ["resumen", "Ficha"],
          ["catalogo", "Catálogo"],
          ["registros", "Registros"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="detail-kpis">
        {[
          ["Envíos", integer(total.sends)],
          [
            "Entrega",
            total.sends ? pct((100 * total.delivered) / total.sends) : "N/D",
          ],
          ["Aperturas", integer(total.opens)],
          ["Clics", integer(total.clicks)],
          ["Rebotes", integer(total.bounces)],
        ].map(([label, value]) => (
          <span key={label}>
            {label}
            <strong>{value}</strong>
          </span>
        ))}
      </div>
      {tab === "resumen" && <FieldPages fields={info} />}
      {tab === "catalogo" &&
        (result.catalogDetail.length ? (
          <>
            <label className="catalog-choice">
              Ficha original
              <select
                aria-label="Ficha de catálogo"
                value={entry}
                onChange={(event) => setEntry(Number(event.target.value))}
              >
                {result.catalogDetail.map((item, index) => (
                  <option key={item.row} value={index}>
                    ID {String(item.fields.ID || "Sin dato")} ·{" "}
                    {String(item.fields.Estado || "Sin dato")} · fila {item.row}
                  </option>
                ))}
              </select>
            </label>
            <FieldPages
              fields={
                result.catalogDetail[
                  Math.min(entry, result.catalogDetail.length - 1)
                ].fields
              }
            />
          </>
        ) : (
          <p>
            Esta campaña no cruza con Campañas Vigentes. Sus estadísticas se
            conservan.
          </p>
        ))}
      {tab === "registros" && (
        <>
          <Records
            rows={result.records}
            pageSize={request.recordPageSize}
            onCapacity={(recordPageSize) =>
              onRequest({ recordPageSize, recordPage: 1 })
            }
          />
          <Pager
            page={request.recordPage}
            count={result.recordCount}
            pageSize={request.recordPageSize}
            onChange={(recordPage) => onRequest({ recordPage })}
          />
        </>
      )}
    </>
  );
}
