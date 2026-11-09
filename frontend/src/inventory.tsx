import { useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowUpDown,
  Check,
  Eye,
  Pencil,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { api, money, number, query, useApi, useDebounce } from "./api";
import {
  Badge,
  Confirm,
  Empty,
  ErrorBox,
  Loading,
  Modal,
  Pager,
  ProductName,
  SearchBox,
} from "./components";
import type { Category, Page, Product, View } from "./types";

export function Inventory({
  replenish,
  version,
  categories,
  changed,
  move,
  go,
}: {
  replenish: boolean;
  version: number;
  categories: Category[];
  changed: (s?: string) => void;
  move: (p: Product, t: "in" | "out") => void;
  go: (v: View) => void;
}) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [status, setStatus] = useState(replenish ? "replenish" : "all"),
    [sort, setSort] = useState("name"),
    [order, setOrder] = useState("asc"),
    [page, setPage] = useState(1),
    [min, setMin] = useState(""),
    [max, setMax] = useState(""),
    [filters, setFilters] = useState(false);
  const [edit, setEdit] = useState<Product>(),
    [remove, setRemove] = useState<Product>(),
    [detail, setDetail] = useState<Product>(),
    [error, setError] = useState("");
  const {
    data,
    loading,
    error: loadError,
    reload,
  } = useApi<Page<Product>>(
    "/products" +
      query({
        q: useDebounce(search),
        category_id: category,
        status,
        sort,
        order,
        page,
        min_price: useDebounce(min),
        max_price: useDebounce(max),
      }),
    version,
  );
  const change = (fn: (s: string) => void, v: string) => {
    fn(v);
    setPage(1);
  };
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {replenish ? "Tu lista de reposición" : "Todos tus productos"}{" "}
              <span className="count-label">{data?.total ?? "—"}</span>
            </h2>
            <p>
              {replenish
                ? "Incluye productos agotados y con stock igual o menor al mínimo."
                : "Gestioná el stock, los precios y los datos de cada producto."}
            </p>
          </div>
          <button
            className={"button secondary small " + (filters ? "selected" : "")}
            onClick={() => setFilters((v) => !v)}
          >
            <SlidersHorizontal size={16} /> Filtros
          </button>
        </div>
        <div className="toolbar">
          <SearchBox value={search} onChange={(v) => change(setSearch, v)} />
          <select
            aria-label="Filtrar por categoría"
            value={category}
            onChange={(e) => change(setCategory, e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por estado de stock"
            value={status}
            onChange={(e) => change(setStatus, e.target.value)}
          >
            {replenish ? (
              <option value="replenish">Todos por reponer</option>
            ) : (
              <option value="all">Todos los estados</option>
            )}
            {!replenish && (
              <option value="available">Con stock disponible</option>
            )}
            <option value="low">Stock bajo</option>
            <option value="out">Agotados</option>
          </select>
        </div>
        {filters && (
          <div className="filter-row">
            <label>
              Precio de venta desde
              <input
                type="number"
                min="0"
                step="0.01"
                value={min}
                placeholder="$ 0,00"
                onChange={(e) => change(setMin, e.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="number"
                min="0"
                step="0.01"
                value={max}
                placeholder="Sin límite"
                onChange={(e) => change(setMax, e.target.value)}
              />
            </label>
            <label>
              Ordenar por
              <select
                value={sort}
                onChange={(e) => change(setSort, e.target.value)}
              >
                <option value="name">Nombre</option>
                <option value="price">Precio de venta</option>
                <option value="stock">Stock disponible</option>
                <option value="created">Fecha de creación</option>
              </select>
            </label>
            <label>
              Orden
              <select
                value={order}
                onChange={(e) => change(setOrder, e.target.value)}
              >
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </select>
            </label>
            <button
              className="text-button"
              onClick={() => {
                setSearch("");
                setCategory("");
                setStatus(replenish ? "replenish" : "all");
                setMin("");
                setMax("");
                setSort("name");
                setOrder("asc");
                setPage(1);
              }}
            >
              Limpiar filtros
            </button>
          </div>
        )}
        {loadError ? (
          <ErrorBox message={loadError} retry={reload} />
        ) : loading ? (
          <Loading />
        ) : !data?.items.length ? (
          <Empty
            title={
              search || category || min || max
                ? "No encontramos coincidencias"
                : replenish
                  ? "No hay productos para reponer"
                  : "Tu inventario empieza acá"
            }
            text="Agregá productos o cambiá los filtros de búsqueda."
            action={
              <button className="button primary" onClick={() => go("add")}>
                <Plus size={16} /> Agregar producto
              </button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th className="numeric">Compra</th>
                  <th className="numeric">Venta</th>
                  <th className="numeric">Stock / mínimo</th>
                  <th>Estado</th>
                  <th className="numeric">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        className="plain-button"
                        onClick={() => setDetail(p)}
                        title="Ver detalle del producto"
                      >
                        <ProductName p={p} />
                      </button>
                    </td>
                    <td className="muted">{p.category}</td>
                    <td className="numeric">{money(p.purchase_price)}</td>
                    <td className="numeric font-semibold">
                      {money(p.sale_price)}
                    </td>
                    <td className="numeric">
                      <strong>{number(p.stock)}</strong>
                      <span className="muted">
                        {" "}
                        / {number(p.minimum_stock)}
                      </span>
                    </td>
                    <td>
                      <Badge product={p} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button text-green"
                          aria-label={`Agregar stock a ${p.name}`}
                          title="Agregar stock"
                          onClick={() => move(p, "in")}
                        >
                          <ArrowDownLeft size={17} />
                        </button>
                        <button
                          className="icon-button text-orange"
                          aria-label={`Retirar stock de ${p.name}`}
                          title="Retirar stock"
                          onClick={() => move(p, "out")}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Editar ${p.name}`}
                          title="Editar"
                          onClick={() => setEdit(p)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Dar de baja ${p.name}`}
                          title="Dar de baja"
                          onClick={() => {
                            setError("");
                            setRemove(p);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={page} total={data.total} onChange={setPage} />}
      </section>
      {edit && (
        <Modal title="Editar producto" wide onClose={() => setEdit(undefined)}>
          <ProductForm
            product={edit}
            categories={categories}
            compact
            onSaved={() => {
              setEdit(undefined);
              changed(
                "Producto actualizado. Su ID e historial se conservaron.",
              );
            }}
            onCancel={() => setEdit(undefined)}
          />
        </Modal>
      )}
      {remove && (
        <Confirm
          title="Dar de baja el producto"
          label="Dar de baja"
          danger
          onClose={() => setRemove(undefined)}
          onConfirm={async () => {
            try {
              await api("/products/" + remove.id, "DELETE");
              setRemove(undefined);
              changed("Producto dado de baja. El historial se conserva.");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <p>
            Vas a dar de baja <strong>{remove.name}</strong>. Dejará de aparecer
            en el inventario. Su código, movimientos e historial de precios se
            conservarán.
          </p>
          {remove.stock > 0 && (
            <div className="notice amber">
              Todavía tiene {number(remove.stock)} unidades. Dejarán de contar
              en los totales del inventario activo.
            </div>
          )}
          {error && <ErrorBox message={error} />}
        </Confirm>
      )}
      {detail && (
        <Modal
          title="Detalle del producto"
          wide
          onClose={() => setDetail(undefined)}
        >
          <div className="modal-body">
            <div className="detail-heading">
              <ProductName p={detail} />
              <Badge product={detail} />
            </div>
            <p className="muted">{detail.description || "Sin descripción"}</p>
            <div className="detail-grid">
              {[
                ["Categoría", detail.category],
                ["Stock disponible", number(detail.stock)],
                ["Precio de compra", money(detail.purchase_price)],
                ["Precio de venta", money(detail.sale_price)],
                ["Diferencia por unidad", money(detail.price_difference)],
                [
                  "Margen bruto estimado",
                  `${Number(detail.gross_margin).toLocaleString("es-AR")} %`,
                ],
                ["Valor a precio de compra", money(detail.purchase_value)],
                ["Valor a precio de venta", money(detail.sale_value)],
                [
                  "Creado",
                  new Date(detail.created_at).toLocaleString("es-AR", {
                    timeZone: "America/Argentina/Buenos_Aires",
                  }),
                ],
                [
                  "Última modificación",
                  new Date(detail.updated_at).toLocaleString("es-AR", {
                    timeZone: "America/Argentina/Buenos_Aires",
                  }),
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <p className="fine-print">
              ID interno: {detail.id}. Margen calculado como (venta − compra) /
              venta. Son estimaciones, no ganancias reales.
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => {
                setDetail(undefined);
                setEdit(detail);
              }}
            >
              <Pencil size={16} /> Editar
            </button>
            <button
              className="button primary"
              onClick={() => {
                setDetail(undefined);
                move(detail, "in");
              }}
            >
              Agregar stock
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function ProductForm({
  product,
  categories,
  onSaved,
  onCancel,
  compact = false,
}: {
  product?: Product;
  categories: Category[];
  onSaved: () => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  const [auto, setAuto] = useState(!product),
    [code, setCode] = useState(product?.code ?? ""),
    [name, setName] = useState(product?.name ?? ""),
    [category, setCategory] = useState(String(product?.category_id ?? "")),
    [description, setDescription] = useState(product?.description ?? ""),
    [purchase, setPurchase] = useState(String(product?.purchase_price ?? "")),
    [sale, setSale] = useState(String(product?.sale_price ?? "")),
    [stock, setStock] = useState("0"),
    [minimum, setMinimum] = useState(String(product?.minimum_stock ?? 0)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [localCats, setLocalCats] = useState<Category[]>([]),
    [newCat, setNewCat] = useState(""),
    [showCat, setShowCat] = useState(false),
    [catBusy, setCatBusy] = useState(false);
  const allCats = [
    ...categories,
    ...localCats.filter((c) => !categories.some((x) => x.id === c.id)),
  ];
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        product ? "/products/" + product.id : "/products",
        product ? "PUT" : "POST",
        {
          name,
          code: auto ? null : code.trim(),
          category_id: category ? Number(category) : null,
          description,
          purchase_price: purchase,
          sale_price: sale,
          minimum_stock: Number(minimum),
          ...(!product ? { initial_stock: Number(stock) } : {}),
        },
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className={compact ? "product-form" : "panel product-form"}
      onSubmit={save}
    >
      {!compact && (
        <div className="panel-heading">
          <div>
            <h2>Datos del producto</h2>
            <p>Los campos con * son obligatorios.</p>
          </div>
        </div>
      )}
      <div className="form-body">
        <div className="form-section-title">
          <span>01</span> Información general
        </div>
        <div className="form-grid">
          <label className="full">
            Nombre del producto *
            <input
              required
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Yerba mate 1 kg"
              autoFocus
            />
          </label>
          <label>
            Tipo de código
            <select
              value={auto ? "auto" : "manual"}
              onChange={(e) => setAuto(e.target.value === "auto")}
              disabled={!!product}
            >
              <option value="auto">Generar automáticamente</option>
              <option value="manual">Ingresar manualmente</option>
            </select>
          </label>
          <label>
            Código {!auto && "*"}
            <input
              maxLength={60}
              required={!auto}
              disabled={auto}
              value={auto ? "Se asignará al guardar" : code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej. BEB-001"
            />
            <small>
              {auto
                ? "Formato correlativo: PROD-000001"
                : "Único dentro de tu comercio."}
            </small>
          </label>
          <label className="full">
            Categoría
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Sin categoría</option>
              {allCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              className="text-button self-start"
              type="button"
              onClick={() => setShowCat((v) => !v)}
            >
              <Plus size={14} /> Crear categoría
            </button>
          </label>
          {showCat && (
            <div className="inline-create full">
              <input
                aria-label="Nombre de la nueva categoría"
                value={newCat}
                maxLength={80}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="Nombre de la categoría"
              />
              <button
                type="button"
                className="button secondary"
                disabled={catBusy || !newCat.trim()}
                onClick={async () => {
                  setCatBusy(true);
                  try {
                    const c = await api<Category>("/categories", "POST", {
                      name: newCat,
                    });
                    setLocalCats((v) => [...v, c]);
                    setCategory(String(c.id));
                    setNewCat("");
                    setShowCat(false);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setCatBusy(false);
                  }
                }}
              >
                Crear
              </button>
            </div>
          )}
          <label className="full">
            Descripción <span className="optional">(opcional)</span>
            <textarea
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles para identificar el producto"
              rows={3}
            />
          </label>
        </div>
        <div className="form-section-title">
          <span>02</span> Precios y cantidades
        </div>
        <div className="form-grid">
          <label>
            Precio de compra (ARS) *
            <input
              type="number"
              required
              min="0"
              max="9999999999.99"
              step="0.01"
              value={purchase}
              onChange={(e) => setPurchase(e.target.value)}
              placeholder="0,00"
            />
          </label>
          <label>
            Precio de venta (ARS) *
            <input
              type="number"
              required
              min="0"
              max="9999999999.99"
              step="0.01"
              value={sale}
              onChange={(e) => setSale(e.target.value)}
              placeholder="0,00"
            />
          </label>
          <label>
            {product ? "Stock actual" : "Stock inicial *"}
            <input
              type="number"
              required
              min="0"
              max="1000000000"
              step="1"
              disabled={!!product}
              value={product ? product.stock : stock}
              onChange={(e) => setStock(e.target.value)}
            />
            <small>
              {product
                ? "Modificá el stock desde Entradas y salidas."
                : "Se guardará como un movimiento de apertura."}
            </small>
          </label>
          <label>
            Stock mínimo *
            <input
              type="number"
              required
              min="0"
              max="1000000000"
              step="1"
              value={minimum}
              onChange={(e) => setMinimum(e.target.value)}
            />
            <small>Te avisamos al llegar a esta cantidad.</small>
          </label>
        </div>
        <div className="price-estimate">
          <div>
            <span>Diferencia por unidad</span>
            <strong>{money(Number(sale) - Number(purchase))}</strong>
          </div>
          <div>
            <span>Margen bruto estimado</span>
            <strong>
              {(Number(sale) > 0
                ? ((Number(sale) - Number(purchase)) / Number(sale)) * 100
                : 0
              ).toLocaleString("es-AR", { maximumFractionDigits: 2 })}{" "}
              %
            </strong>
          </div>
          <small>
            Estimaciones de precios. No representan ganancias reales.
          </small>
        </div>
        {error && <ErrorBox message={error} />}
      </div>
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button className="button primary" disabled={busy}>
          <Save size={17} />
          {busy
            ? "Guardando…"
            : product
              ? "Guardar cambios"
              : "Guardar producto"}
        </button>
      </div>
    </form>
  );
}
