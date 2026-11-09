# Almacén · Control de inventario v.1

Aplicación web local para un único comercio. React + TypeScript + Tailwind CSS + Vite, API REST con FastAPI y SQLite mediante SQLAlchemy. Interfaz en español de Argentina e importes en ARS.

Permite administrar productos y categorías, registrar entradas, salidas y ajustes, consultar alertas e informes históricos, calcular la ganancia estimada de cada salida y actualizar precios con una vista previa. No incluye facturación, caja ni clientes.

## Ejecutar en Windows 11

Requisitos: Python **3.11 o superior**, Node.js **20.19 o superior** (con npm) o pnpm **11**. La instalación inicial necesita Internet. Después funciona localmente y sin conexión. Verificado con Python 3.14, Node 24 y pnpm 11.

Abrí PowerShell en esta carpeta y ejecutá:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\instalar.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\iniciar.ps1
```

El primer comando instala las dependencias y compila la interfaz. El segundo inicia FastAPI, aplica las migraciones pendientes y abre [la aplicación](http://127.0.0.1:8000). El navegador se abre cuando el servidor responde. Para los arranques siguientes también podés hacer doble clic en **Iniciar Inventario.cmd**.

Mantené abierta la consola del servidor. **Ctrl+C** lo detiene. Los datos quedan guardados. Para iniciar sin abrir un navegador usá `iniciar.ps1 -SinNavegador`. Se utiliza un solo proceso de servidor y el puerto 8000; el script comprueba que esté libre.

La base de producción se crea vacía en `backend/data/inventory.db`. No tiene productos ni categorías precargados.

## Modo de demostración independiente

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\iniciar.ps1 -Demo
```

Genera, únicamente la primera vez, una base en `backend/data/demo/inventory.db` con datos **ficticios**. Las modificaciones de la demostración persisten solo allí. Detené el servidor antes de cambiar de modo. Para volver a producción, abrí una PowerShell nueva y ejecutá el inicio normal; si usás la misma sesión, quitá primero la variable con `Remove-Item Env:INVENTORY_DB -ErrorAction SilentlyContinue`.

También se puede generar una base ficticia con `python backend/demo.py --db RUTA_NUEVA`. El generador rechaza bases existentes y la ruta de producción predeterminada.

## Uso

1. En **Configuración**, definí el nombre del comercio, las categorías y el inicio de la semana.
2. En **Agregar producto**, elegí código automático o manual, precios, stock inicial y stock mínimo. También podés crear una categoría desde el formulario.
3. En **Inventario**, buscá por nombre o código, filtrá por categoría, estado o precios y ordená los resultados. El nombre abre el detalle con las valoraciones y el margen estimado. Los íconos permiten entrar o retirar stock, editar o dar de baja.
4. En **Entradas y salidas**, elegí producto, cantidad y confirmá. Ves el stock anterior y posterior. Cada salida muestra su **ganancia estimada** antes y después de confirmar. Para corregir un error de stock, registrá un **Ajuste** con dirección y motivo; el registro original permanece.
5. **Productos por reponer** reúne los agotados y los que tienen stock positivo menor o igual al mínimo.
6. **Movimientos y resúmenes** calcula entradas, salidas, neto, valores históricos, saldo de ganancia estimada y rankings por día, semana, mes o rango. La tabla de historial tiene sus propios filtros por producto, fecha y tipo, y muestra la ganancia de cada salida. Inicio muestra también el saldo estimado de hoy.
7. **Actualización de precios** permite seleccionar todos los productos, una categoría o productos individuales. Elegí aumento o disminución, compra/venta/ambos y redondeo. Generá una vista previa y confirmala. El historial incluye las ediciones individuales.

Todas las tablas principales tienen paginación. En celular, el menú se abre desde el botón superior y las tablas se desplazan horizontalmente dentro de su panel.

## Copias de seguridad y restauración

En **Configuración → Copias de seguridad**, presioná **Crear copia** y luego **Descargar**. La copia incluye productos, categorías, movimientos, historial de precios, correlativo de códigos y preferencias. SQLite Online Backup incluye los datos pendientes en WAL; no se copia únicamente el archivo `.db` mientras está en uso.

Las copias se conservan en una carpeta `backups` junto a la base seleccionada. Guardá también una copia descargada fuera de esta PC. No se borran automáticamente.

Para restaurar, seleccioná un archivo `.sqlite3`, `.sqlite` o `.db` de hasta 50 MB, escribí **RESTAURAR** y confirmá. Se verifican el formato, la versión del esquema, las columnas, la integridad, las referencias y la coincidencia entre stock e historial. Antes del reemplazo se crea una copia automática del estado actual, que aparece en la lista y puede restaurarse de la misma forma.

Usá **una sola instancia del servidor**, como hace `iniciar.ps1`, especialmente durante una restauración. La aplicación no es un servicio multiusuario de red ni un servidor público.

## Datos, cálculos e integridad

### Ganancia estimada por salida

Se considera cada salida de mercadería para calcular **(precio de venta − precio de compra) × cantidad**. Por ejemplo: compra $100,10, venta $150,25 y salida de 3 unidades → **$150,45**. Si el precio de venta es menor al de compra, se muestra el saldo negativo; si coinciden, $0,00.

Al confirmar una salida se guardan ambos precios vigentes. El historial y los saldos por día, semana, mes o rango usan esos valores, aunque luego cambien los precios del producto o se dé de baja. Entradas, aperturas y ajustes no generan ganancia estimada. El cálculo no incluye gastos, impuestos ni descuentos y no representa una ganancia neta real.

La migración `0002` se aplica automáticamente al iniciar. Las salidas anteriores a esta mejora aparecen como **Sin datos** porque no se había guardado su precio de venta. Los resúmenes indican cuántas se excluyeron y muestran el saldo conocido como subtotal. No se reconstruyen precios históricos usando valores actuales. Las copias de la versión anterior siguen siendo restaurables: se validan y migran antes del reemplazo.

- El ID interno no se modifica ni se reutiliza. Los códigos manuales se normalizan a mayúsculas y se exige unicidad, incluso para productos dados de baja. La generación correlativa evita colisiones con códigos manuales existentes.
- Toda baja de producto es lógica. El código queda reservado y los movimientos e historiales permanecen. La interfaz pide confirmación antes de la baja.
- El stock inicial positivo genera un movimiento de apertura. Un stock inicial cero no genera un movimiento de cantidad cero.
- Cada movimiento guarda producto, código y nombre históricos, cantidad, delta, stock anterior/posterior, costo de referencia, nota y fecha/hora UTC. Las nuevas salidas guardan también el precio de venta de referencia.
- Se muestran fechas y se calculan límites de períodos con **America/Argentina/Buenos_Aires**. El inicio de semana es configurable de lunes a domingo.
- El neto de los informes es **entradas − salidas**. Aperturas y ajustes se muestran por separado para distinguir reposiciones y retiros de correcciones. Cambiar un precio actual no modifica los costos históricos.
- Los importes usan `Decimal` y un tipo monetario SQLAlchemy que almacena **centavos enteros** en SQLite. Así se evita la conversión de `NUMERIC` a flotantes de SQLite. La API entrega los importes como cadenas decimales con dos posiciones, también en valoraciones grandes.
- Diferencia por unidad = venta − compra. Margen bruto estimado = diferencia / venta × 100; si venta es cero se informa cero. Son estimaciones, no ganancias comerciales.
- El redondeo masivo usa el múltiplo más cercano de $0,01, $1, $10 o $100, con mitades hacia arriba. Un identificador de la vista previa detecta cambios en los productos antes de aplicar: si algo cambió, exige volver a generar la vista previa.
- Los movimientos y cambios masivos son transaccionales con `BEGIN IMMEDIATE`, claves foráneas, restricciones, WAL y espera de bloqueos. Las solicitudes se coordinan sin bloquear el grupo de hilos durante una restauración. Hay pruebas tanto por API como con sesiones independientes de SQLite.
- Límites de entrada: hasta 1.000.000.000 unidades de stock y $9.999.999.999,99 por precio unitario. Se rechazan cantidades cero, negativas, fraccionarias y retiros superiores al stock. Los rangos de informes admiten años 1900–9998.
- El servidor escucha solo en `127.0.0.1`. Las escrituras requieren la cabecera `X-Inventory-Client: web` y verifican el origen del navegador. No hay autenticación, conforme al alcance local solicitado.

## Desarrollo

Backend, desde la raíz:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

Frontend, en otra consola:

```powershell
cd frontend
pnpm dev
# Si instalaste con npm: npm run dev
```

Abrí el enlace local que imprime Vite, normalmente `http://127.0.0.1:5173`. Su proxy conecta `/api` con FastAPI. El arranque normal usa los archivos compilados y solo necesita el puerto 8000. Reconstruí con `pnpm build` o `npm run build` después de cambiar el frontend para usar el arranque normal.

La documentación de la API está en [Swagger](http://127.0.0.1:8000/docs). Para escrituras desde un cliente REST, enviá `X-Inventory-Client: web`. Ejemplo PowerShell:

```powershell
$headers = @{ 'X-Inventory-Client' = 'web' }
$body = @{ name='Producto de ejemplo'; purchase_price='100.10'; sale_price='150.25'; initial_stock=10; minimum_stock=3 } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8000/api/products -Method Post -Headers $headers -ContentType 'application/json' -Body $body
```

Configuración opcional: `.env.example` documenta `INVENTORY_DB`. No se carga automáticamente un archivo `.env`; definí la variable en la sesión antes de iniciar:

```powershell
$env:INVENTORY_DB = 'C:\InventarioDatos\inventory.db'
.\iniciar.ps1
```

## Migraciones

Se usa Alembic. El backend aplica `upgrade head` al iniciar. Para ejecutar manualmente sobre la base predeterminada:

```powershell
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
```

Para otra ruta, usá el arranque con `INVENTORY_DB`; el comando Alembic manual toma la URL de `backend/alembic.ini`. No se utiliza `create_all` para crear el esquema de producción. Para una futura migración, creá un archivo de versión nuevo y hacé antes una copia.

## Pruebas y verificación

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\probar.ps1
# Solo backend:
.\.venv\Scripts\python.exe -m pytest -q -c backend\pytest.ini
```

Las pruebas usan bases temporales independientes. Cubren productos, códigos, búsquedas, categorías, entradas/salidas/ajustes, stock mínimo, precios, redondeo, confirmación de vista previa, informes y límites de zona horaria, baja lógica, precisión monetaria, copias/restauración y operaciones simultáneas. El frontend se verifica con TypeScript y compilación de producción.

La verificación manual del navegador está documentada en `VERIFICACION.md`.

## Estructura

```text
backend/
  app/
    api.py             Rutas, validaciones REST y coordinación de solicitudes
    models.py          Modelos relacionales y tipo monetario exacto
    schemas.py         Validaciones Pydantic
    services.py        Stock, precios, resúmenes y códigos
    serialization.py   Importes decimales exactos en JSON
    backups.py         Copias y restauración
    database.py        SQLite, sesiones y migraciones
    main.py            Punto de entrada
  migrations/          Migraciones Alembic versionadas
  tests/               Pruebas Pytest
  demo.py              Generador de datos ficticios aislados
frontend/
  src/
    App.tsx            Navegación y dashboard
    inventory.tsx      Inventario y formulario reutilizable
    stock.tsx          Entradas, salidas y ajustes
    reports.tsx        Resúmenes e historial
    prices.tsx         Vista previa e historial de precios
    settings.tsx       Comercio, categorías y copias
    components.tsx     Tablas, diálogos, alertas y controles comunes
    api.ts             Cliente REST, carga y formatos locales
    types.ts           Contratos TypeScript
    styles.css         Tailwind y estilos responsive
instalar.ps1           Instalación y compilación
iniciar.ps1            Arranque local o demostración
probar.ps1             Pruebas y compilación
```

Las bases, copias, entornos virtuales, dependencias y compilados se excluyen de Git. `requirements-lock.txt` y `pnpm-lock.yaml` conservan las versiones verificadas.
