import type { Query, QueryResult } from "../types";
import { integer, pct } from "../lib/numbers";
import { Pager } from "../components/Records";
import { usePageCapacity } from "../lib/usePageCapacity";
export default function CampaignsView({
  result,
  request,
  onRequest,
  onSelect,
  onExport,
  exporting,
  onInventory,
}: {
  result: QueryResult;
  request: Query;
  onRequest: (next: Partial<Query>) => void;
  onSelect: (name: string) => void;
  onExport: () => void;
  exporting: boolean;
  onInventory: () => void;
}) {
  const table = usePageCapacity(
    request.pageSize || 1,
    request.selected === null
      ? (pageSize) => onRequest({ pageSize, page: 1 })
      : undefined,
  );
  const sort = (key: Query["sort"]) =>
    onRequest({
      sort: key,
      ascending: request.sort === key ? !request.ascending : key === "name",
      page: 1,
    });
  return (
    <section className="glass view-panel">
      <div className="section-heading">
        <div>
          <h1>Campañas</h1>
          <p>
            Nombres originales · {integer(result.campaignCount)} campañas en
            esta selección
          </p>
        </div>
        <button className="primary" disabled={exporting} onClick={onExport}>
          {exporting ? "Preparando…" : "Exportar registros CSV"}
        </button>
      </div>
      <div className="panel-tabs">
        <button aria-pressed>Rendimiento</button>
        <button onClick={onInventory}>Inventario completo</button>
      </div>
      <div className="table-scroll" ref={table} aria-label="Campañas paginadas">
        <table>
          <thead>
            <tr>
              {(["name", "sends", "opens", "clicks"] as const).map(
                (key, index) => (
                  <th
                    key={key}
                    aria-sort={
                      request.sort === key
                        ? request.ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    {key === "sends" && (
                      <select
                        className="compact-sort"
                        aria-label="Ordenar campañas"
                        value={request.sort}
                        onChange={(event) =>
                          onRequest({
                            sort: event.target.value as Query["sort"],
                            ascending: event.target.value === "name",
                            page: 1,
                          })
                        }
                      >
                        <option value="sends">Envíos ↓</option>
                        <option value="opens">Aperturas ↓</option>
                        <option value="clicks">Clics ↓</option>
                        <option value="name">Nombre ↑</option>
                      </select>
                    )}
                    <button
                      className={key === "sends" ? "full-sort" : ""}
                      onClick={() => sort(key)}
                    >
                      {
                        [
                          "Campaña",
                          "Envíos",
                          "Aperturas únicas",
                          "Clics únicos",
                        ][index]
                      }{" "}
                      {request.sort === key
                        ? request.ascending
                          ? "↑"
                          : "↓"
                        : "↕"}
                    </button>
                  </th>
                ),
              )}
              <th>Entrega</th>
              <th>Registros</th>
            </tr>
          </thead>
          <tbody>
            {result.campaigns.map((campaign) => (
              <tr key={campaign.name}>
                <td className="campaign-cell" title={campaign.name}>
                  <button
                    className="text-button"
                    onClick={() => onSelect(campaign.name)}
                  >
                    {campaign.name}
                  </button>
                </td>
                <td data-label="Envíos">
                  <span className="full-sort">
                    {integer(campaign.totals.sends)}
                  </span>
                  <span className="compact-metric">
                    {integer(
                      campaign.totals[
                        request.sort === "opens" || request.sort === "clicks"
                          ? request.sort
                          : "sends"
                      ],
                    )}
                  </span>
                </td>
                <td className="secondary-column" data-label="Aperturas">
                  {integer(campaign.totals.opens)}
                </td>
                <td className="secondary-column" data-label="Clics">
                  {integer(campaign.totals.clicks)}
                </td>
                <td className="secondary-column" data-label="Entrega">
                  {campaign.totals.sends
                    ? pct(
                        (campaign.totals.delivered / campaign.totals.sends) *
                          100,
                      )
                    : "N/D"}
                </td>
                <td className="secondary-column">
                  {integer(campaign.totals.rows)}
                </td>
              </tr>
            ))}
            {!result.campaigns.length && (
              <tr>
                <td colSpan={6}>No hay campañas para esta selección.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager
        page={request.page}
        count={result.campaignCount}
        pageSize={request.pageSize}
        onChange={(page) => onRequest({ page })}
      />
    </section>
  );
}
