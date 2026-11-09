import { useEffect, useRef, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  Package,
  Search,
  X,
} from "lucide-react";
import { datetime, money, number } from "./api";
import type { Money, Movement, Product } from "./types";

export function IconBox({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"icon-box " + tone}>{children}</span>;
}
export function Empty({
  title = "Todavía no hay productos",
  text = "Agregá tu primer producto para empezar a organizar tu inventario.",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={19} />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={23} /> Cargando información…
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Buscar por nombre o código…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-box">
      <Search size={18} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button aria-label="Limpiar búsqueda" onClick={() => onChange("")}>
          <X size={15} />
        </button>
      )}
    </div>
  );
}
export function Badge({ product }: { product: Pick<Product, "status"> }) {
  return (
    <span className={"badge " + product.status}>
      <i />
      {product.status === "normal"
        ? "Disponible"
        : product.status === "low"
          ? "Stock bajo"
          : "Agotado"}
    </span>
  );
}
export const movementLabels = {
  opening: "Apertura",
  in: "Entrada",
  out: "Salida",
  adjustment: "Ajuste",
};
export function MovementTag({ m }: { m: Movement }) {
  return (
    <span className={"movement-tag " + (m.delta > 0 ? "positive" : "negative")}>
      {m.delta > 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{" "}
      {movementLabels[m.type]}
    </span>
  );
}
export function ProductName({ p }: { p: Pick<Product, "name" | "code"> }) {
  return (
    <div className="product-name">
      <span className="product-tile">
        <Package size={19} />
      </span>
      <span>
        <strong>{p.name}</strong>
        <small>{p.code}</small>
      </span>
    </div>
  );
}
export function Pager({
  page,
  total,
  size = 12,
  onChange,
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="pager">
      <span>
        {total
          ? `${number((page - 1) * size + 1)}–${number(Math.min(page * size, total))} de ${number(total)}`
          : "0 resultados"}
      </span>
      <div>
        <button
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          Página {page} de {pages}
        </span>
        <button
          aria-label="Página siguiente"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide" : "")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Cerrar ventana"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Confirm({
  title,
  children,
  label = "Confirmar",
  onClose,
  onConfirm,
  danger = false,
}: {
  title: string;
  children: ReactNode;
  label?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  danger?: boolean;
}) {
  const ref = useRef(false);
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!ref.current) onClose();
      }}
    >
      <div className="modal-body">{children}</div>
      <div className="modal-actions">
        <button
          className="button secondary"
          onClick={() => {
            if (!ref.current) onClose();
          }}
        >
          Cancelar
        </button>
        <button
          className={"button " + (danger ? "danger" : "primary")}
          onClick={async (e) => {
            if (ref.current) return;
            ref.current = true;
            const b = e.currentTarget;
            b.disabled = true;
            try {
              await onConfirm();
            } finally {
              ref.current = false;
              b.disabled = false;
            }
          }}
        >
          {label}
        </button>
      </div>
    </Modal>
  );
}
export function ProfitAmount({
  value,
  missing = 0,
}: {
  value: Money | null;
  missing?: number;
}) {
  if (value === null)
    return (
      <span
        className="muted"
        title="No se guardó el precio de venta en este movimiento."
      >
        Sin datos
      </span>
    );
  return (
    <span
      className={
        "profit-amount " +
        (String(value).startsWith("-") ? "text-red" : "text-green")
      }
    >
      {money(value)}
      {missing > 0 && (
        <small className="muted">
          Subtotal · {number(missing)}{" "}
          {missing === 1 ? "salida sin datos" : "salidas sin datos"}
        </small>
      )}
    </span>
  );
}

export function MovementTable({ rows }: { rows: Movement[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Fecha y hora</th>
            <th>Movimiento</th>
            <th className="numeric">Cantidad</th>
            <th className="numeric">Ganancia estimada</th>
            <th className="numeric">Stock anterior</th>
            <th className="numeric">Stock posterior</th>
            <th className="numeric">Compra / venta por unidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td>
                <ProductName
                  p={{ name: m.product_name, code: m.product_code }}
                />
                {m.note && <small className="note">{m.note}</small>}
              </td>
              <td className="muted nowrap">{datetime(m.created_at)}</td>
              <td>
                <MovementTag m={m} />
              </td>
              <td
                className={
                  "numeric font-semibold " +
                  (m.delta > 0 ? "text-green" : "text-orange")
                }
              >
                {m.delta > 0 ? "+" : "−"}
                {number(m.quantity)}
              </td>
              <td className="numeric font-semibold">
                {m.type === "out" ? (
                  <ProfitAmount value={m.estimated_profit} />
                ) : (
                  "—"
                )}
              </td>
              <td className="numeric muted">{number(m.stock_before)}</td>
              <td className="numeric font-semibold">{number(m.stock_after)}</td>
              <td className="numeric muted">
                {m.type === "out" ? (
                  <>
                    {money(m.reference_cost)} /{" "}
                    {m.reference_sale_price === null
                      ? "Sin datos"
                      : money(m.reference_sale_price)}
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
