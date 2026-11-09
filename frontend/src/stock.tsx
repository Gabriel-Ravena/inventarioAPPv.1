import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Package,
  RefreshCw,
} from "lucide-react";
import { api, money, number, query, useApi, useDebounce } from "./api";
import { estimateProfit } from "./profit";
import {
  Badge,
  Confirm,
  Empty,
  ErrorBox,
  Loading,
  MovementTable,
  ProductName,
  ProfitAmount,
  SearchBox,
} from "./components";
import type { Movement, Page, Product } from "./types";

export function Stock({
  initialProduct,
  initialType,
  version,
  changed,
}: {
  initialProduct?: Product;
  initialType: "in" | "out";
  version: number;
  changed: (s?: string) => void;
}) {
  const [kind, setKind] = useState<"in" | "out" | "adjustment">(initialType),
    [direction, setDirection] = useState("in"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(initialProduct),
    [quantity, setQuantity] = useState("1"),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [last, setLast] = useState<Movement>();
  const products = useApi<Page<Product>>(
    "/products" + query({ q: useDebounce(search), page_size: 8 }),
    version,
  );
  const recent = useApi<Page<Movement>>(
    "/movements" + query({ product_id: selected?.id, page_size: 5 }),
    version,
  );
  useEffect(() => {
    if (!selected) return;
    api<Product>("/products/" + selected.id)
      .then(setSelected)
      .catch(() => setSelected(undefined));
  }, [version]);
  const delta =
      (kind === "out" || (kind === "adjustment" && direction === "out")
        ? -1
        : 1) * Number(quantity),
    next = (selected?.stock ?? 0) + delta;
  const profit =
    selected && kind === "out"
      ? estimateProfit(
          selected.purchase_price,
          selected.sale_price,
          Number(quantity),
        )
      : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selected) {
      setError("Seleccioná un producto.");
      return;
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
      setError("Ingresá una cantidad entera mayor a cero.");
      return;
    }
    if (next < 0) {
      setError("La cantidad supera el stock disponible.");
      return;
    }
    setConfirm(true);
  };
  return (
    <>
      <div className="stock-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>1. Elegí tu producto</h2>
              <p>Buscá por código o nombre.</p>
            </div>
            <Package size={21} className="muted" />
          </div>
          <div className="stock-search">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Escribí o pegá el código…"
            />
          </div>
          <div className="product-picker">
            {products.error ? (
              <ErrorBox message={products.error} retry={products.reload} />
            ) : products.loading ? (
              <Loading />
            ) : !products.data?.items.length ? (
              <Empty
                title="Sin productos para mostrar"
                text="Agregá un producto o probá con otro código."
              />
            ) : (
              products.data.items.map((p) => (
                <button
                  className={
                    "picker-row " + (selected?.id === p.id ? "selected" : "")
                  }
                  key={p.id}
                  onClick={() => {
                    setSelected(p);
                    setLast(undefined);
                    setError("");
                  }}
                >
                  <ProductName p={p} />
                  <span>
                    <strong>{number(p.stock)} un.</strong>
                    <Badge product={p} />
                  </span>
                  {selected?.id === p.id && <Check size={18} />}
                </button>
              ))
            )}
          </div>
          {(products.data?.total ?? 0) > 8 && (
            <p className="fine-print px-6 pb-4">
              Hay más productos. Afiná tu búsqueda para encontrarlos.
            </p>
          )}
        </section>
        <form className="panel stock-form" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <h2>2. Registrá el movimiento</h2>
              <p>Una operación simple, un stock actualizado.</p>
            </div>
          </div>
          <div className="form-body">
            <div className="movement-tabs">
              {(
                [
                  ["in", "Entrada", ArrowDownLeft],
                  ["out", "Salida", ArrowUpRight],
                  ["adjustment", "Ajuste", RefreshCw],
                ] as const
              ).map(([t, label, Icon]) => (
                <button
                  key={t}
                  type="button"
                  className={kind === t ? "selected" : ""}
                  onClick={() => {
                    setKind(t);
                    setError("");
                  }}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
            {selected ? (
              <div className="selected-product">
                <ProductName p={selected} />
                <span className="stock-chip">
                  {number(selected.stock)} disponibles
                </span>
              </div>
            ) : (
              <div className="notice">
                Seleccioná un producto de la lista para continuar.
              </div>
            )}
            {kind === "adjustment" && (
              <>
                <div className="notice amber">
                  Los ajustes corrigen errores de conteo. El historial original
                  se conserva.
                </div>
                <label>
                  Dirección del ajuste
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                  >
                    <option value="in">Sumar unidades</option>
                    <option value="out">Restar unidades</option>
                  </select>
                </label>
              </>
            )}
            <label>
              Cantidad de unidades *
              <input
                className="quantity-input"
                type="number"
                required
                min="1"
                max="1000000000"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label>
              {kind === "adjustment"
                ? "Motivo del ajuste *"
                : "Nota (opcional)"}
              <input
                required={kind === "adjustment"}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  kind === "adjustment"
                    ? "Ej. Corrección de conteo"
                    : "Ej. Reposición de mercadería"
                }
              />
            </label>
            <div className="stock-preview">
              <div>
                <small>Stock actual</small>
                <strong>{number(selected?.stock ?? 0)}</strong>
              </div>
              <ArrowRight size={24} />
              <div>
                <small>Nuevo stock</small>
                <strong className={next < 0 ? "text-red" : "text-green"}>
                  {selected ? number(next) : "—"}
                </strong>
              </div>
            </div>
            {error && <ErrorBox message={error} />}
            {selected && kind === "out" && profit !== null && (
              <div className="profit-preview">
                <span>Ganancia estimada de esta salida</span>
                <strong>
                  <ProfitAmount value={profit} />
                </strong>
                <small>
                  ({money(selected.sale_price)} −{" "}
                  {money(selected.purchase_price)}) × {number(Number(quantity))}{" "}
                  unidades. No incluye gastos.
                </small>
              </div>
            )}
            <button
              disabled={!selected}
              className={"button full " + (delta < 0 ? "outgoing" : "primary")}
            >
              {kind === "adjustment" ? (
                <RefreshCw size={19} />
              ) : delta < 0 ? (
                <ArrowUpRight size={20} />
              ) : (
                <ArrowDownLeft size={20} />
              )}{" "}
              {kind === "adjustment"
                ? "Registrar ajuste"
                : kind === "out"
                  ? "Retirar stock"
                  : "Agregar stock"}
            </button>
            {last && (
              <div className="success-box" role="status">
                <Check size={19} />
                <div>
                  <strong>Movimiento registrado</strong>
                  <p>
                    {number(last.stock_before)} → {number(last.stock_after)}{" "}
                    unidades. El stock ya está actualizado.
                  </p>
                  {last.type === "out" && (
                    <p>
                      Ganancia estimada:{" "}
                      <strong>
                        <ProfitAmount value={last.estimated_profit} />
                      </strong>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
      <section className="panel mt-6">
        <div className="panel-heading">
          <div>
            <h2>
              {selected
                ? "Historial de " + selected.name
                : "Movimientos recientes"}
            </h2>
            <p>Los últimos registros, incluidos los ajustes y la apertura.</p>
          </div>
        </div>
        {recent.error ? (
          <ErrorBox message={recent.error} retry={recent.reload} />
        ) : recent.loading ? (
          <Loading />
        ) : recent.data?.items.length ? (
          <MovementTable rows={recent.data.items} />
        ) : (
          <Empty
            title="Sin movimientos todavía"
            text="Cuando registres una operación, vas a verla acá."
          />
        )}
      </section>
      {confirm && selected && (
        <Confirm
          title="Confirmar movimiento"
          label={
            kind === "out"
              ? "Retirar stock"
              : kind === "in"
                ? "Agregar stock"
                : "Confirmar ajuste"
          }
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            try {
              const m = await api<Movement>("/movements", "POST", {
                product_id: selected.id,
                type: kind,
                quantity: Number(quantity),
                direction,
                note,
              });
              setSelected({ ...selected, stock: m.stock_after });
              setLast(m);
              setConfirm(false);
              setQuantity("1");
              setNote("");
              changed(
                `${m.product_name}: stock actualizado de ${number(m.stock_before)} a ${number(m.stock_after)} unidades.`,
              );
            } catch (e) {
              setError((e as Error).message);
              setConfirm(false);
            }
          }}
        >
          <p>
            <strong>{selected.name}</strong> · {selected.code}
          </p>
          <div className="stock-preview">
            <div>
              <small>Stock anterior</small>
              <strong>{number(selected.stock)}</strong>
            </div>
            <ArrowRight size={24} />
            <div>
              <small>Stock posterior</small>
              <strong>{number(next)}</strong>
            </div>
          </div>
          <p className="muted">
            Se registrarán {number(Number(quantity))} unidades y se guardará la
            fecha, la hora y el costo de referencia.
          </p>
          {kind === "out" && profit !== null && (
            <div className="profit-preview">
              <span>Ganancia estimada de esta salida</span>
              <strong>
                <ProfitAmount value={profit} />
              </strong>
              <small>
                Se guardan los precios de compra y venta vigentes. No incluye
                gastos.
              </small>
            </div>
          )}
        </Confirm>
      )}
    </>
  );
}
