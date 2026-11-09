import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Layers,
  MoveHorizontal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { localDate, money, number, query, useApi, useDebounce } from "./api";
import {
  Empty,
  ErrorBox,
  IconBox,
  Loading,
  MovementTable,
  Pager,
  ProfitAmount,
  SearchBox,
} from "./components";
import type { Group, Movement, Page, Report } from "./types";

export function Reports({ version }: { version: number }) {
  const [period, setPeriod] = useState("day"),
    [anchor, setAnchor] = useState(localDate()),
    [start, setStart] = useState(localDate()),
    [end, setEnd] = useState(localDate()),
    [groupPage, setGroupPage] = useState(1);
  const [q, setQ] = useState(""),
    [kind, setKind] = useState("all"),
    [historyStart, setHistoryStart] = useState(""),
    [historyEnd, setHistoryEnd] = useState(""),
    [page, setPage] = useState(1);
  const report = useApi<Report>(
    "/reports" +
      query({
        period,
        anchor,
        start: period === "custom" ? start : undefined,
        end: period === "custom" ? end : undefined,
      }),
    version,
  );
  const history = useApi<Page<Movement>>(
    "/movements" +
      query({
        q: useDebounce(q),
        type: kind,
        start: historyStart,
        end: historyEnd,
        page,
      }),
    version,
  );
  const d = report.data;
  return (
    <>
      <section className="panel period-panel">
        <div className="period-tabs">
          {[
            ["day", "Día"],
            ["week", "Semana"],
            ["month", "Mes"],
            ["custom", "Rango personalizado"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={period === v ? "selected" : ""}
              onClick={() => {
                setPeriod(v);
                setGroupPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="period-dates">
          <CalendarDays size={17} />
          {period === "custom" ? (
            <>
              <label>
                Desde
                <input
                  aria-label="Resumen desde"
                  type="date"
                  required
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setGroupPage(1);
                  }}
                />
              </label>
              <label>
                Hasta
                <input
                  aria-label="Resumen hasta"
                  type="date"
                  required
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setGroupPage(1);
                  }}
                />
              </label>
            </>
          ) : (
            <label>
              Fecha de referencia
              <input
                aria-label="Fecha de referencia del resumen"
                type="date"
                required
                value={anchor}
                onChange={(e) => {
                  setAnchor(e.target.value);
                  setGroupPage(1);
                }}
              />
            </label>
          )}
        </div>
      </section>
      {report.error ? (
        <ErrorBox message={report.error} retry={report.reload} />
      ) : report.loading || !d ? (
        <Loading />
      ) : (
        <>
          <div className="report-range">
            <span>
              {new Date(d.start + "T12:00:00").toLocaleDateString("es-AR")} —{" "}
              {new Date(d.end + "T12:00:00").toLocaleDateString("es-AR")}
            </span>
            <span>
              {number(d.movement_count)} movimientos · Hora de Buenos Aires
            </span>
          </div>
          <div className="summary-grid report-metrics">
            {[
              ["Unidades ingresadas", d.incoming, ArrowDownLeft, "sage"],
              ["Unidades retiradas", d.outgoing, ArrowUpRight, "amber"],
              ["Diferencia neta", d.net, MoveHorizontal, "blue"],
              ["Ajustes netos", d.adjustment_net, Layers, "sage"],
            ].map(([label, value, Icon, tone]) => {
              const I = Icon as typeof Layers;
              return (
                <div className="metric" key={String(label)}>
                  <div className="metric-top">
                    <span>{String(label)}</span>
                    <IconBox tone={String(tone)}>
                      <I size={20} />
                    </IconBox>
                  </div>
                  <strong className="metric-value">
                    {number(Number(value))}
                  </strong>
                  <small>
                    {label === "Ajustes netos"
                      ? "correcciones de conteo"
                      : "unidades en el período"}
                  </small>
                </div>
              );
            })}
          </div>
          <div className="report-values">
            <div>
              <span>Entradas a costo histórico</span>
              <strong>{money(d.incoming_value)}</strong>
            </div>
            <div>
              <span>Salidas a costo histórico</span>
              <strong>{money(d.outgoing_value)}</strong>
            </div>
            <div>
              <span>Saldo de ganancia estimada</span>
              <strong>
                <ProfitAmount
                  value={d.estimated_profit}
                  missing={d.unpriced_outgoing_count}
                />
              </strong>
            </div>
            <p>
              Ganancia estimada = (venta − compra) × cantidad en cada salida,
              con los precios guardados al registrarla. No incluye gastos ni
              ajustes. Las salidas sin precio histórico no se suman. Aperturas:{" "}
              {number(d.opening)} un. ({money(d.opening_value)}). Ajustes:{" "}
              {money(d.adjustment_value)}.
            </p>
          </div>
          <div className="two-columns">
            <Ranking
              title="Productos con más entradas"
              groups={d.top_incoming}
              type="incoming"
            />
            <Ranking
              title="Productos con más salidas"
              groups={d.top_outgoing}
              type="outgoing"
            />
          </div>
          <section className="panel mt-6">
            <div className="panel-heading">
              <div>
                <h2>Movimientos por producto</h2>
                <p>Totales automáticos del período seleccionado.</p>
              </div>
            </div>
            {d.products.length ? (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className="numeric">Entradas</th>
                        <th className="numeric">Salidas</th>
                        <th className="numeric">Neto</th>
                        <th className="numeric">Apertura / ajustes</th>
                        <th className="numeric">Costo entradas / salidas</th>
                        <th className="numeric">Ganancia estimada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.products
                        .slice((groupPage - 1) * 12, groupPage * 12)
                        .map((g) => (
                          <tr key={g.product_id}>
                            <td>
                              <strong>{g.name}</strong>
                              <small className="block muted">{g.code}</small>
                            </td>
                            <td className="numeric text-green">
                              +{number(g.incoming)}
                            </td>
                            <td className="numeric text-orange">
                              −{number(g.outgoing)}
                            </td>
                            <td className="numeric font-semibold">
                              {number(g.incoming - g.outgoing)}
                            </td>
                            <td className="numeric muted">
                              {number(g.opening)} / {number(g.adjustment_net)}
                            </td>
                            <td className="numeric">
                              {money(g.incoming_value)} /{" "}
                              {money(g.outgoing_value)}
                            </td>
                            <td className="numeric font-semibold">
                              {g.outgoing > 0 ? (
                                <ProfitAmount
                                  value={g.estimated_profit}
                                  missing={g.unpriced_outgoing_count}
                                />
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <Pager
                  page={groupPage}
                  total={d.products.length}
                  onChange={setGroupPage}
                />
              </>
            ) : (
              <Empty
                title="Sin movimientos en este período"
                text="Probá con otra fecha o registrá una entrada o salida."
              />
            )}
          </section>
        </>
      )}
      <section className="panel mt-6">
        <div className="panel-heading">
          <div>
            <h2>Historial de movimientos</h2>
            <p>
              Registro completo. Los nombres y códigos corresponden al momento
              de la operación.
            </p>
          </div>
        </div>
        <div className="toolbar">
          <SearchBox
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
          />
          <select
            aria-label="Filtrar tipo de movimiento"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos los movimientos</option>
            <option value="in">Entradas</option>
            <option value="out">Salidas</option>
            <option value="opening">Aperturas</option>
            <option value="adjustment">Ajustes</option>
          </select>
        </div>
        <div className="filter-row">
          <label>
            Desde
            <input
              type="date"
              value={historyStart}
              onChange={(e) => {
                setHistoryStart(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={historyEnd}
              onChange={(e) => {
                setHistoryEnd(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <button
            className="text-button"
            onClick={() => {
              setHistoryStart("");
              setHistoryEnd("");
              setQ("");
              setKind("all");
              setPage(1);
            }}
          >
            Limpiar filtros
          </button>
        </div>
        {history.error ? (
          <ErrorBox message={history.error} retry={history.reload} />
        ) : history.loading ? (
          <Loading />
        ) : history.data?.items.length ? (
          <MovementTable rows={history.data.items} />
        ) : (
          <Empty
            title="No hay registros"
            text="Los movimientos aparecerán acá cuando empieces a operar."
          />
        )}
        {history.data && (
          <Pager page={page} total={history.data.total} onChange={setPage} />
        )}
      </section>
    </>
  );
}
function Ranking({
  title,
  groups,
  type,
}: {
  title: string;
  groups: Group[];
  type: "incoming" | "outgoing";
}) {
  const max = Math.max(1, ...groups.map((g) => g[type]));
  return (
    <section className="panel ranking-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        {type === "incoming" ? (
          <TrendingUp size={20} className="text-green" />
        ) : (
          <TrendingDown size={20} className="text-orange" />
        )}
      </div>
      {groups.length ? (
        <div className="rankings">
          {groups.map((g, i) => (
            <div key={g.product_id} className="ranking-row">
              <span className="rank-number">{i + 1}</span>
              <div>
                <span>{g.name}</span>
                <div className={"ranking-track " + type}>
                  <i style={{ width: (g[type] / max) * 100 + "%" }} />
                </div>
              </div>
              <strong>
                {number(g[type])} <small>un.</small>
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Sin datos todavía"
          text="No hubo movimientos de este tipo en el período."
        />
      )}
    </section>
  );
}
