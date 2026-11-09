import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Package,
  PackagePlus,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Tags,
  TriangleAlert,
  TrendingUp,
  X,
} from "lucide-react";
import { api, money, number, useApi } from "./api";
import {
  Badge,
  Empty,
  ErrorBox,
  IconBox,
  Loading,
  MovementTable,
  ProductName,
  ProfitAmount,
} from "./components";
import type { Category, Dashboard, Product, Settings, View } from "./types";
import { Inventory, ProductForm } from "./inventory";
import { Stock } from "./stock";
import { Reports } from "./reports";
import { Prices } from "./prices";
import { Configuration } from "./settings";

const navigation: [View, string, typeof Package][] = [
  ["home", "Inicio", LayoutDashboard],
  ["inventory", "Inventario", Boxes],
  ["add", "Agregar producto", PackagePlus],
  ["stock", "Entradas y salidas", RefreshCw],
  ["replenish", "Productos por reponer", TriangleAlert],
  ["reports", "Movimientos y resúmenes", BarChart3],
  ["prices", "Actualización de precios", Tags],
  ["settings", "Configuración", SettingsIcon],
];
export default function App() {
  const [view, setView] = useState<View>(() => {
    const v = location.hash.slice(1);
    return navigation.some((n) => n[0] === v) ? (v as View) : "home";
  });
  const [version, setVersion] = useState(0),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState("");
  const [stockProduct, setStockProduct] = useState<Product>(),
    [stockType, setStockType] = useState<"in" | "out">("in");
  const settings = useApi<Settings>("/settings", version),
    cats = useApi<Category[]>("/categories", version);
  useEffect(() => {
    const handler = () => {
      const v = location.hash.slice(1);
      setView(navigation.some((n) => n[0] === v) ? (v as View) : "home");
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  const go = (v: View) => {
    location.hash = v;
    setView(v);
    setMobile(false);
    window.scrollTo({ top: 0 });
  };
  const changed = (message = "Cambios guardados correctamente.") => {
    setVersion((v) => v + 1);
    setToast(message);
  };
  const move = (product: Product | undefined, type: "in" | "out") => {
    setStockProduct(product);
    setStockType(type);
    go("stock");
  };
  const title = navigation.find((n) => n[0] === view)![1];
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Cerrar menú"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a className="brand" href="#home" onClick={() => go("home")}>
          <span className="brand-mark">
            <Boxes size={25} />
          </span>
          <span>
            almacén<span className="brand-dot">.</span>
            <small>CONTROL DE INVENTARIO</small>
          </span>
        </a>
        <div className="shop-card">
          <span className="shop-icon">
            <Store size={18} />
          </span>
          <div>
            <strong>{settings.data?.shop_name ?? "Mi comercio"}</strong>
            <small>
              <i /> Espacio local
            </small>
          </div>
        </div>
        <span className="nav-label">TU COMERCIO</span>
        <nav aria-label="Menú principal">
          {navigation.map(([v, label, Icon], i) => (
            <button
              key={v}
              className={
                (view === v ? "active " : "") + (i === 7 ? "settings-nav" : "")
              }
              onClick={() => go(v)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {view === v && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={19} />
          <div>
            <strong>Todo bajo control</strong>
            <p>Tus datos se guardan en esta PC.</p>
          </div>
        </div>
        <div className="sidebar-footer">
          ALMACÉN <span>v1.0 · Local</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Mi espacio</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-indicator">
              <i /> Modo local
            </span>
            <span className="avatar">
              {(settings.data?.shop_name ?? "Mi comercio")
                .slice(0, 2)
                .toUpperCase()}
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {view === "home"
                  ? "UNA MIRADA A TU COMERCIO"
                  : "CONTROL DE INVENTARIO"}
              </span>
              <h1>{view === "home" ? "Tu inventario, al día." : title}</h1>
              <p>
                {
                  (
                    {
                      home: "Un resumen claro de lo que entra, lo que sale y lo que tenés.",
                      inventory:
                        "Cada producto en su lugar. Encontrá y administrá tu mercadería.",
                      add: "Cargá los datos de tu producto y empezá a controlar su stock.",
                      stock:
                        "Registrá lo que entra y lo que sale, en pocos pasos.",
                      replenish:
                        "Que no te falte nada. Estos productos necesitan tu atención.",
                      reports:
                        "Conocé cómo se mueve tu mercadería a lo largo del tiempo.",
                      prices:
                        "Mantené tus precios actualizados, con control de cada cambio.",
                      settings:
                        "Tu comercio, tus preferencias y tus copias de seguridad.",
                    } as Record<View, string>
                  )[view]
                }
              </p>
            </div>
            {view === "home" || view === "inventory" || view === "replenish" ? (
              <button className="button primary" onClick={() => go("add")}>
                <Plus size={18} /> Agregar producto
              </button>
            ) : (
              <span className="heading-date">
                {new Date().toLocaleDateString("es-AR", {
                  timeZone: "America/Argentina/Buenos_Aires",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          {settings.error && (
            <ErrorBox message={settings.error} retry={settings.reload} />
          )}
          {view === "home" && <Home version={version} go={go} move={move} />}
          {(view === "inventory" || view === "replenish") && (
            <Inventory
              key={view}
              replenish={view === "replenish"}
              version={version}
              categories={cats.data ?? []}
              changed={changed}
              move={move}
              go={go}
            />
          )}
          {view === "add" && (
            <ProductForm
              categories={cats.data ?? []}
              onSaved={() => {
                changed(
                  "Producto agregado. El stock inicial quedó registrado.",
                );
                go("inventory");
              }}
              onCancel={() => go("inventory")}
            />
          )}
          {view === "stock" && (
            <Stock
              key={`${stockProduct?.id ?? 0}-${stockType}`}
              initialProduct={stockProduct}
              initialType={stockType}
              version={version}
              changed={changed}
            />
          )}
          {view === "reports" && <Reports version={version} />}
          {view === "prices" && (
            <Prices
              version={version}
              categories={cats.data ?? []}
              changed={changed}
            />
          )}
          {view === "settings" && (
            <Configuration
              version={version}
              settings={settings.data}
              categories={cats.data ?? []}
              changed={changed}
            />
          )}
          <footer className="main-footer">
            <span>
              <Boxes size={14} /> Hecho para tener todo en orden.
            </span>
            <span>Control de inventario · ARS</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={19} />
          </span>
          {toast}
          <button aria-label="Cerrar aviso" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function Home({
  version,
  go,
  move,
}: {
  version: number;
  go: (v: View) => void;
  move: (p: Product | undefined, t: "in" | "out") => void;
}) {
  const {
    data: d,
    error,
    loading,
    reload,
  } = useApi<Dashboard>("/dashboard", version);
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (loading || !d) return <Loading />;
  const replenish = d.low_count + d.out_count,
    max = Math.max(5, ...d.chart.flatMap((c) => [c.incoming, c.outgoing]));
  return (
    <>
      <div className="summary-grid">
        <Metric
          label="Productos diferentes"
          value={number(d.product_count)}
          sub="en tu inventario"
          icon={<Package size={21} />}
          tone="sage"
        />
        <Metric
          label="Unidades disponibles"
          value={number(d.units)}
          sub="listas en tu comercio"
          icon={<Boxes size={21} />}
          tone="blue"
        />
        <Metric
          label="Stock bajo"
          value={number(d.low_count)}
          sub="productos para reponer"
          icon={<TriangleAlert size={21} />}
          tone="amber"
          onClick={() => go("replenish")}
        />
        <Metric
          label="Productos agotados"
          value={number(d.out_count)}
          sub="sin unidades disponibles"
          icon={<ClipboardList size={21} />}
          tone="rose"
          onClick={() => go("replenish")}
        />
      </div>
      <section className="panel profit-balance">
        <div>
          <h2>Saldo de ganancia estimada de hoy</h2>
          <p>(Venta − compra) × cantidad de cada salida. No incluye gastos.</p>
        </div>
        <strong>
          <ProfitAmount
            value={d.today_estimated_profit}
            missing={d.today_unpriced_outgoing_count}
          />
        </strong>
      </section>
      <div className="quick-actions">
        <div>
          <span className="mini-caption">¿QUÉ NECESITÁS HACER?</span>
          <strong>Tu stock, en movimiento</strong>
        </div>
        <button
          className="button incoming"
          onClick={() => move(undefined, "in")}
        >
          <ArrowDownLeft size={19} /> Registrar entrada <Plus size={16} />
        </button>
        <button
          className="button outgoing"
          onClick={() => move(undefined, "out")}
        >
          <ArrowUpRight size={19} /> Registrar salida <ArrowRight size={16} />
        </button>
        <button className="button secondary" onClick={() => go("inventory")}>
          <Boxes size={18} /> Ver inventario
        </button>
      </div>
      <div className="dashboard-middle">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Movimiento de mercadería</h2>
              <p>Entradas y salidas de los últimos 7 días</p>
            </div>
            <span className="pill">Esta semana</span>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-in" /> Entradas
            </span>
            <span>
              <i className="legend-out" /> Salidas
            </span>
            <span className="chart-unit">Unidades</span>
          </div>
          <div className="bar-chart">
            <div className="chart-scale">
              {[
                max,
                Math.round(max * 0.75),
                Math.round(max * 0.5),
                Math.round(max * 0.25),
                0,
              ].map((n, i) => (
                <span key={i}>{number(n)}</span>
              ))}
            </div>
            <div className="chart-plot">
              <div className="chart-grid">
                {[0, 1, 2, 3, 4].map((i) => (
                  <i key={i} />
                ))}
              </div>
              {d.chart.map((c) => (
                <div className="chart-day" key={c.date}>
                  <div
                    className="bars"
                    title={`${c.date}: ${c.incoming} entradas, ${c.outgoing} salidas`}
                  >
                    <div
                      className="bar in-bar"
                      style={{ height: `${(c.incoming / max) * 100}%` }}
                    />
                    <div
                      className="bar out-bar"
                      style={{ height: `${(c.outgoing / max) * 100}%` }}
                    />
                  </div>
                  <span>
                    {new Date(c.date + "T12:00:00-03:00").toLocaleDateString(
                      "es-AR",
                      { weekday: "short" },
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-bottom">
            <span>
              <i /> Hoy
            </span>
            <strong className="text-green">
              +{number(d.today_incoming)} <small>entradas</small>
            </strong>
            <strong className="text-orange">
              −{number(d.today_outgoing)} <small>salidas</small>
            </strong>
          </div>
        </section>
        <section className="valuation-panel">
          <span className="valuation-icon">
            <TrendingUp size={24} />
          </span>
          <span className="mini-caption">EL VALOR DE TU STOCK</span>
          <h2>
            Una visión de lo
            <br />
            que tenés.
          </h2>
          <div className="valuation-amount">
            <span>A precio de compra</span>
            <strong>{money(d.purchase_value)}</strong>
          </div>
          <div className="valuation-amount selling">
            <span>A precio de venta</span>
            <strong>{money(d.sale_value)}</strong>
          </div>
          <p>
            <CircleHelp size={15} /> Valores estimados del stock actual. No
            representan ganancias.
          </p>
        </section>
      </div>
      <div className="dashboard-lower">
        <section className="panel">
          <div className="panel-heading">
            <div className="flex items-center gap-3">
              <IconBox tone="amber">
                <TriangleAlert size={18} />
              </IconBox>
              <div>
                <h2>Un ojo en la reposición</h2>
                <p>
                  {replenish
                    ? `${number(replenish)} productos necesitan atención`
                    : "Tu inventario está en orden"}
                </p>
              </div>
            </div>
            <button className="text-button" onClick={() => go("replenish")}>
              Ver todos <ArrowRight size={15} />
            </button>
          </div>
          {d.replenish.length ? (
            <div className="replenish-list">
              {d.replenish.map((p) => (
                <button
                  className="replenish-row"
                  key={p.id}
                  onClick={() => move(p, "in")}
                >
                  <ProductName p={p} />
                  <span>
                    <strong>
                      {number(p.stock)} <small>un.</small>
                    </strong>
                    <small>Mín. {number(p.minimum_stock)}</small>
                  </span>
                  <Badge product={p} />
                  <Plus size={17} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="Todo en su lugar"
              text={
                d.product_count
                  ? "Todos tus productos están por encima del stock mínimo."
                  : "Las alertas aparecerán acá cuando cargues tus productos."
              }
            />
          )}
        </section>
        <section className="panel getting-started">
          <div className="panel-heading">
            <div>
              <h2>
                {d.product_count
                  ? "Tu comercio, organizado"
                  : "Un buen comienzo"}
              </h2>
              <p>
                {d.product_count
                  ? "Información que te acompaña cada día"
                  : "Tu inventario empieza con un producto"}
              </p>
              <IconBox tone="sage">
                <Store size={20} />
              </IconBox>
            </div>
          </div>
          <div className="start-illustration" aria-hidden="true">
            <div className="draw-box one">
              <Package size={40} />
            </div>
            <div className="draw-box two">
              <Boxes size={52} />
            </div>
            <span className="draw-check">
              <Check size={19} />
            </span>
          </div>
          <p>
            {d.product_count
              ? "Consultá tus resúmenes para descubrir qué productos se mueven más."
              : "Cargá tu mercadería, definí un stock mínimo y dejá que el orden haga el resto."}
          </p>
          <button
            className="text-button"
            onClick={() => go(d.product_count ? "reports" : "add")}
          >
            {d.product_count
              ? "Explorar resúmenes"
              : "Agregar mi primer producto"}{" "}
            <ArrowRight size={16} />
          </button>
        </section>
      </div>
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h2>Últimos movimientos</h2>
            <p>La actividad más reciente de tu inventario</p>
          </div>
          <button className="text-button" onClick={() => go("reports")}>
            Ver historial <ArrowRight size={15} />
          </button>
        </div>
        {d.recent.length ? (
          <MovementTable rows={d.recent} />
        ) : (
          <Empty
            title="Todavía está todo tranquilo"
            text="Tus entradas, salidas y ajustes de stock aparecerán acá."
          />
        )}
      </section>
    </>
  );
}
export function Metric({
  label,
  value,
  sub,
  icon,
  tone = "sage",
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="metric-top">
        <span>{label}</span>
        <IconBox tone={tone}>{icon}</IconBox>
      </div>
      <strong className="metric-value">{value}</strong>
      <small>{sub}</small>
    </>
  );
  return onClick ? (
    <button className="metric metric-button" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="metric">{content}</div>
  );
}
