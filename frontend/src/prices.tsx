import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Eye, History, Percent } from "lucide-react";
import { api, datetime, money, query, useApi, useDebounce } from "./api";
import {
  Confirm,
  Empty,
  ErrorBox,
  Loading,
  Pager,
  ProductName,
  SearchBox,
} from "./components";
import type {
  Category,
  Page,
  PriceHistory,
  PricePreview,
  Product,
} from "./types";

export function Prices({
  version,
  categories,
  changed,
}: {
  version: number;
  categories: Category[];
  changed: (s?: string) => void;
}) {
  const [scope, setScope] = useState("all"),
    [category, setCategory] = useState(""),
    [target, setTarget] = useState("sale"),
    [operation, setOperation] = useState("increase"),
    [percentage, setPercentage] = useState("10"),
    [rounding, setRounding] = useState("0.01"),
    [selected, setSelected] = useState<Product[]>([]),
    [search, setSearch] = useState(""),
    [selectPage, setSelectPage] = useState(1),
    [previewPage, setPreviewPage] = useState(1),
    [historyPage, setHistoryPage] = useState(1),
    [preview, setPreview] = useState<PricePreview>(),
    [pendingRequest, setPendingRequest] = useState<Record<string, unknown>>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const products = useApi<Page<Product>>(
    "/products" + query({ q: useDebounce(search), page: selectPage }),
    version,
  );
  const history = useApi<Page<PriceHistory>>(
    "/prices/history" + query({ page: historyPage }),
    version,
  );
  const invalidate = () => {
    setPreview(undefined);
    setPendingRequest(undefined);
    setError("");
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const request = {
        scope,
        category_id: category ? Number(category) : null,
        product_ids: selected.map((p) => p.id),
        target,
        percentage: String(
          (operation === "decrease" ? -1 : 1) * Number(percentage),
        ),
        rounding,
      };
      const result = await api<PricePreview>(
        "/prices/preview",
        "POST",
        request,
      );
      setPendingRequest(request);
      setPreview(result);
      setPreviewPage(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="notice">
        <Percent size={19} />
        <span>
          Probá el cambio antes de aplicarlo. Tus precios se modificarán
          únicamente cuando confirmes la vista previa.
        </span>
      </div>
      <form className="panel mt-6" onSubmit={submit}>
        <div className="panel-heading">
          <div>
            <h2>Actualización masiva</h2>
            <p>
              Aplicá un porcentaje a los precios de los productos que elijas.
            </p>
          </div>
        </div>
        <div className="form-body">
          <div className="form-grid three">
            <label>
              Productos a actualizar
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  invalidate();
                }}
              >
                <option value="all">Todos los productos</option>
                <option value="category">Una categoría</option>
                <option value="selected">Selección individual</option>
              </select>
            </label>
            <label>
              Precios a modificar
              <select
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  invalidate();
                }}
              >
                <option value="sale">Precio de venta</option>
                <option value="purchase">Precio de compra</option>
                <option value="both">Compra y venta</option>
              </select>
            </label>
            <label>
              Redondeo
              <select
                value={rounding}
                onChange={(e) => {
                  setRounding(e.target.value);
                  invalidate();
                }}
              >
                <option value="0.01">A centavos ($ 0,01)</option>
                <option value="1">Al peso ($ 1)</option>
                <option value="10">A decenas ($ 10)</option>
                <option value="100">A centenas ($ 100)</option>
              </select>
              <small>Al múltiplo más cercano; mitad hacia arriba.</small>
            </label>
            {scope === "category" && (
              <label className="full">
                Categoría
                <select
                  required
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    invalidate();
                  }}
                >
                  <option value="">Elegí una categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Tipo de cambio
              <select
                value={operation}
                onChange={(e) => {
                  setOperation(e.target.value);
                  invalidate();
                }}
              >
                <option value="increase">Aumento</option>
                <option value="decrease">Disminución</option>
              </select>
            </label>
            <label>
              Porcentaje *
              <input
                type="number"
                min="0.01"
                max={operation === "decrease" ? "100" : "10000"}
                step="0.01"
                required
                value={percentage}
                onChange={(e) => {
                  setPercentage(e.target.value);
                  invalidate();
                }}
              />
            </label>
          </div>
          {scope === "selected" && (
            <div className="selection-section">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3>{selected.length} productos seleccionados</h3>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setSelected([]);
                    invalidate();
                  }}
                >
                  Quitar selección
                </button>
              </div>
              <SearchBox
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setSelectPage(1);
                }}
              />
              {products.error ? (
                <ErrorBox message={products.error} retry={products.reload} />
              ) : products.loading ? (
                <Loading />
              ) : (
                <div className="selection-grid">
                  {products.data?.items.map((p) => (
                    <label className="selection-item" key={p.id}>
                      <input
                        type="checkbox"
                        checked={selected.some((s) => s.id === p.id)}
                        onChange={(e) => {
                          setSelected((s) =>
                            e.target.checked
                              ? [...s, p]
                              : s.filter((x) => x.id !== p.id),
                          );
                          invalidate();
                        }}
                      />
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {p.code} · {money(p.sale_price)}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {products.data && (
                <Pager
                  page={selectPage}
                  total={products.data.total}
                  onChange={setSelectPage}
                />
              )}
            </div>
          )}
          {error && <ErrorBox message={error} />}
        </div>
        <div className="form-actions">
          <button className="button primary" disabled={busy}>
            <Eye size={18} />
            {busy ? "Calculando…" : "Generar vista previa"}
          </button>
        </div>
      </form>
      {preview && (
        <section className="panel mt-6">
          <div className="panel-heading">
            <div>
              <h2>Vista previa · {preview.count} productos</h2>
              <p>Revisá los valores antes de confirmar.</p>
            </div>
            <span className="pill">Sin aplicar</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="numeric">Compra anterior</th>
                  <th className="numeric">Compra nueva</th>
                  <th className="numeric">Venta anterior</th>
                  <th className="numeric">Venta nueva</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows
                  .slice((previewPage - 1) * 12, previewPage * 12)
                  .map((p) => (
                    <tr key={p.id}>
                      <td>
                        <ProductName p={p} />
                      </td>
                      <td className="numeric muted">{money(p.old_purchase)}</td>
                      <td className="numeric font-semibold">
                        {money(p.new_purchase)}
                      </td>
                      <td className="numeric muted">{money(p.old_sale)}</td>
                      <td className="numeric font-semibold text-green">
                        {money(p.new_sale)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Pager
            page={previewPage}
            total={preview.count}
            onChange={setPreviewPage}
          />
          <div className="form-actions">
            <button className="button secondary" onClick={invalidate}>
              Descartar
            </button>
            <button className="button primary" onClick={() => setConfirm(true)}>
              <Check size={18} /> Confirmar actualización
            </button>
          </div>
        </section>
      )}
      <section className="panel mt-6">
        <div className="panel-heading">
          <div>
            <h2>Historial de precios</h2>
            <p>Cambios individuales y masivos, conservados por producto.</p>
          </div>
          <History size={21} className="muted" />
        </div>
        {history.error ? (
          <ErrorBox message={history.error} retry={history.reload} />
        ) : history.loading ? (
          <Loading />
        ) : history.data?.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Producto / fecha</th>
                  <th>Motivo</th>
                  <th className="numeric">Compra anterior → nueva</th>
                  <th className="numeric">Venta anterior → nueva</th>
                </tr>
              </thead>
              <tbody>
                {history.data.items.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <strong>{h.product_name}</strong>
                      <small className="block muted">
                        {h.product_code} · {datetime(h.created_at)}
                      </small>
                    </td>
                    <td className="muted">{h.reason}</td>
                    <td className="numeric">
                      {money(h.old_purchase)} →{" "}
                      <strong>{money(h.new_purchase)}</strong>
                    </td>
                    <td className="numeric">
                      {money(h.old_sale)} → <strong>{money(h.new_sale)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Tus precios, sin cambios"
            text="Cada modificación de precio quedará registrada acá."
          />
        )}
        {history.data && (
          <Pager
            page={historyPage}
            total={history.data.total}
            onChange={setHistoryPage}
          />
        )}
      </section>
      {confirm && preview && pendingRequest && (
        <Confirm
          title="Aplicar nuevos precios"
          label="Aplicar actualización"
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            try {
              await api("/prices/apply", "POST", {
                ...pendingRequest,
                preview_token: preview.preview_token,
              });
              setConfirm(false);
              invalidate();
              changed(
                "Precios actualizados. Los cambios quedaron guardados en el historial.",
              );
            } catch (e) {
              setConfirm(false);
              setError((e as Error).message);
              setPreview(undefined);
            }
          }}
        >
          <p>
            Vas a actualizar los precios de{" "}
            <strong>{preview.count} productos</strong> con los importes de la
            vista previa.
          </p>
          <p className="muted">
            Los costos de referencia de los movimientos anteriores se conservan.
          </p>
        </Confirm>
      )}
    </>
  );
}
