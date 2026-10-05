import type { Query, QueryResult } from "../types";
import { integer, pct } from "../lib/numbers";
import { Pager } from "../components/Records";
export default function CampaignsView({
  result,
  request,
  onRequest,
  onSelect,
  onExport,
  exporting,
}: {
  result: QueryResult;
  request: Query;
  onRequest: (next: Partial<Query>) => void;
  onSelect: (name: string) => void;
  onExport: () => void;
  exporting: boolean;
}) {
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
      <div
        className="table-scroll"
        tabIndex={0}
        aria-label="Tabla de campañas; desplazamiento horizontal disponible"
      >
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
                    <button onClick={() => sort(key)}>
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
                <td className="campaign-cell">
                  <button
                    className="text-button"
                    onClick={() => onSelect(campaign.name)}
                  >
                    {campaign.name}
                  </button>
                </td>
                <td>{integer(campaign.totals.sends)}</td>
                <td>{integer(campaign.totals.opens)}</td>
                <td>{integer(campaign.totals.clicks)}</td>
                <td>
                  {campaign.totals.sends
                    ? pct(
                        (campaign.totals.delivered / campaign.totals.sends) *
                          100,
                      )
                    : "N/D"}
                </td>
                <td>{integer(campaign.totals.rows)}</td>
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
        onChange={(page) => onRequest({ page })}
      />
    </section>
  );
}
