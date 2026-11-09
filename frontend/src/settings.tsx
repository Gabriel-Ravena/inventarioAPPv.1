import { useEffect, useState, type FormEvent } from "react";
import {
  DatabaseBackup,
  Download,
  FolderOpen,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { api, datetime, useApi } from "./api";
import { Confirm, Empty, ErrorBox, Loading, Modal } from "./components";
import type { Backup, Category, Settings } from "./types";

export function Configuration({
  settings,
  categories,
  version,
  changed,
}: {
  settings?: Settings;
  categories: Category[];
  version: number;
  changed: (s?: string) => void;
}) {
  const [name, setName] = useState(settings?.shop_name ?? "Mi comercio"),
    [week, setWeek] = useState(settings?.week_start ?? 0),
    [busy, setBusy] = useState(false),
    [backupBusy, setBackupBusy] = useState(false),
    [error, setError] = useState(""),
    [categoryName, setCategoryName] = useState(""),
    [edit, setEdit] = useState<Category>(),
    [editName, setEditName] = useState(""),
    [remove, setRemove] = useState<Category>(),
    [file, setFile] = useState<File>(),
    [confirmation, setConfirmation] = useState(""),
    [restore, setRestore] = useState(false),
    [fileKey, setFileKey] = useState(0);
  const backups = useApi<Backup[]>("/backups", version);
  useEffect(() => {
    if (settings) {
      setName(settings.shop_name);
      setWeek(settings.week_start);
    }
  }, [settings]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/settings", "PUT", {
        shop_name: name,
        week_start: Number(week),
      });
      changed("Preferencias guardadas.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {error && <ErrorBox message={error} />}
      <div className="two-columns config-columns">
        <form className="panel" onSubmit={save}>
          <div className="panel-heading">
            <div>
              <h2>Tu comercio</h2>
              <p>Preferencias para el inventario y los resúmenes.</p>
            </div>
          </div>
          <div className="form-body">
            <label>
              Nombre del comercio *
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Inicio de la semana
              <select
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
              >
                {[
                  "Lunes",
                  "Martes",
                  "Miércoles",
                  "Jueves",
                  "Viernes",
                  "Sábado",
                  "Domingo",
                ].map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Zona horaria
              <input readOnly value="America/Argentina/Buenos_Aires" />
              <small>Se usa en todos los movimientos y resúmenes.</small>
            </label>
            <div className="notice">
              <ShieldCheck size={20} />
              <span>
                Aplicación local para un único comercio. La base de datos
                permanece en esta PC.
              </span>
            </div>
          </div>
          <div className="form-actions">
            <button className="button primary" disabled={busy}>
              <Save size={17} />
              {busy ? "Guardando…" : "Guardar preferencias"}
            </button>
          </div>
        </form>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Categorías</h2>
              <p>Organizá tus productos de una forma simple.</p>
            </div>
            <FolderOpen size={20} className="muted" />
          </div>
          <form
            className="inline-create px-6 pb-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("/categories", "POST", { name: categoryName });
                setCategoryName("");
                changed("Categoría creada.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              aria-label="Nombre de categoría"
              required
              maxLength={80}
              placeholder="Nueva categoría"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
            <button className="button secondary" disabled={busy}>
              <Plus size={17} /> Agregar
            </button>
          </form>
          <div className="category-list">
            {categories.length ? (
              categories.map((c) => (
                <div key={c.id}>
                  <span>{c.name}</span>
                  <button
                    className="icon-button"
                    aria-label={`Editar categoría ${c.name}`}
                    onClick={() => {
                      setEdit(c);
                      setEditName(c.name);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Eliminar categoría ${c.name}`}
                    onClick={() => setRemove(c)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            ) : (
              <Empty
                title="Cada cosa en su categoría"
                text="Creá categorías para encontrar tus productos más rápido."
              />
            )}
          </div>
        </section>
      </div>
      <section className="panel mt-6">
        <div className="panel-heading">
          <div>
            <h2>Copias de seguridad</h2>
            <p>
              Guardá una copia completa de productos, movimientos, precios y
              configuración.
            </p>
          </div>
          <button
            className="button primary"
            disabled={backupBusy}
            onClick={async () => {
              setBackupBusy(true);
              setError("");
              try {
                await api("/backups", "POST");
                changed("Copia de seguridad creada. Ya podés descargarla.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBackupBusy(false);
              }
            }}
          >
            <DatabaseBackup size={18} />
            {backupBusy ? "Creando copia…" : "Crear copia"}
          </button>
        </div>
        <div className="notice mx-6 mb-5">
          <ShieldCheck size={20} />
          <span>
            Las copias se guardan junto a la base de datos. Descargá una copia y
            conservá otra en un dispositivo diferente.
          </span>
        </div>
        {backups.error ? (
          <ErrorBox message={backups.error} retry={backups.reload} />
        ) : backups.loading ? (
          <Loading />
        ) : backups.data?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Creada</th>
                  <th>Tamaño</th>
                  <th className="numeric">Descargar</th>
                </tr>
              </thead>
              <tbody>
                {backups.data.map((b) => (
                  <tr key={b.name}>
                    <td className="backup-filename">{b.name}</td>
                    <td>{datetime(b.created_at)}</td>
                    <td>
                      {(b.size / 1024).toLocaleString("es-AR", {
                        maximumFractionDigits: 1,
                      })}{" "}
                      KB
                    </td>
                    <td className="numeric">
                      <a
                        className="button secondary small inline-flex"
                        href={"/api/backups/" + encodeURIComponent(b.name)}
                        download
                      >
                        <Download size={16} /> Descargar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Una copia es tranquilidad"
            text="Creá tu primera copia para proteger la información de tu comercio."
          />
        )}
      </section>
      <form
        className="panel mt-6 restore-panel"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (!file) {
            setError("Seleccioná una copia de seguridad.");
            return;
          }
          if (file.size > 50 * 1024 * 1024) {
            setError("El archivo supera los 50 MB.");
            return;
          }
          setRestore(true);
        }}
      >
        <div className="panel-heading">
          <div>
            <h2>Restaurar una copia</h2>
            <p>Volvé al estado guardado en un archivo de respaldo.</p>
          </div>
          <Upload size={20} className="muted" />
        </div>
        <div className="form-body">
          <div className="notice amber">
            La restauración reemplaza los datos actuales. Antes se creará
            automáticamente una copia de seguridad del estado actual.
          </div>
          <div className="form-grid">
            <label>
              Archivo de copia (SQLite, hasta 50 MB)
              <input
                key={fileKey}
                type="file"
                accept=".sqlite3,.db,.sqlite"
                required
                onChange={(e) => setFile(e.target.files?.[0])}
              />
            </label>
            <label>
              Escribí RESTAURAR para continuar
              <input
                required
                pattern="RESTAURAR"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="RESTAURAR"
                autoComplete="off"
              />
            </label>
          </div>
        </div>
        <div className="form-actions">
          <button
            className="button danger-outline"
            disabled={!file || confirmation !== "RESTAURAR"}
          >
            <Upload size={17} /> Restaurar copia
          </button>
        </div>
      </form>
      {edit && (
        <Modal title="Editar categoría" onClose={() => setEdit(undefined)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("/categories/" + edit.id, "PUT", { name: editName });
                setEdit(undefined);
                changed("Categoría actualizada.");
              } catch (e) {
                setError((e as Error).message);
                setEdit(undefined);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="modal-body">
              <label>
                Nombre
                <input
                  required
                  maxLength={80}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setEdit(undefined)}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={busy}>
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      )}
      {remove && (
        <Confirm
          title="Eliminar categoría"
          label="Eliminar"
          danger
          onClose={() => setRemove(undefined)}
          onConfirm={async () => {
            try {
              await api("/categories/" + remove.id, "DELETE");
              setRemove(undefined);
              changed("Categoría eliminada.");
            } catch (e) {
              setError((e as Error).message);
              setRemove(undefined);
            }
          }}
        >
          <p>
            ¿Querés eliminar la categoría <strong>{remove.name}</strong>?
          </p>
          <p className="muted">
            Solo se puede eliminar si no tiene productos asociados.
          </p>
        </Confirm>
      )}
      {restore && file && (
        <Confirm
          title="Restaurar el inventario"
          label="Reemplazar datos y restaurar"
          danger
          onClose={() => setRestore(false)}
          onConfirm={async () => {
            const data = new FormData();
            data.append("file", file);
            data.append("confirmation", confirmation);
            try {
              const result = await api<{ safety_backup: string }>(
                "/restore",
                "POST",
                data,
              );
              setRestore(false);
              setFile(undefined);
              setConfirmation("");
              setFileKey((k) => k + 1);
              changed(
                "Copia restaurada. Se guardó un respaldo de los datos anteriores: " +
                  result.safety_backup,
              );
            } catch (e) {
              setRestore(false);
              setError((e as Error).message);
            }
          }}
        >
          <p>
            Archivo: <strong>{file.name}</strong>
          </p>
          <p>
            Se reemplazará el inventario actual por los datos de esta copia.
            Esta acción afecta productos, movimientos, precios y configuración.
          </p>
          <div className="notice amber">
            Se validará la integridad del archivo y se conservará una copia del
            estado actual.
          </div>
        </Confirm>
      )}
    </>
  );
}
