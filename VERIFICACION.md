# Verificación del proyecto

Fecha: 9 de noviembre de 2026. Entorno: Windows, Python 3.14, Node.js 24 y pnpm 11.

## Resultado

- **40 pruebas Pytest aprobadas** sobre bases temporales independientes, incluidas las nuevas pruebas de ganancia estimada.
- **TypeScript y compilación Vite de producción aprobados**.
- `instalar.ps1` ejecutado correctamente sobre el entorno de esta entrega: comprobación de dependencias, instalación del frontend y compilación.
- `iniciar.ps1 -SinNavegador` ejecutado correctamente con Windows PowerShell. Sirvió la aplicación y creó una base de producción vacía con las migraciones.
- Interfaz revisada en navegador real, tanto en escritorio como con un ancho de celular de 390 px.

## Cobertura por etapa

| Etapa | Comprobaciones |
| --- | --- |
| 1. Estructura, base y productos | Migración inicial, alta, edición, ID permanente, persistencia tras reiniciar, validaciones de datos. |
| 2. Búsquedas, categorías y códigos | Código completo y parcial, nombre parcial, mayúsculas y acentos, filtros, orden y paginación; códigos manuales/automáticos únicos, incluso en altas simultáneas. |
| 3. Stock | Apertura, entradas, salidas, ajustes con motivo, rechazo de cero/negativos/fracciones, retiro insuficiente sin cambios parciales. |
| 4. Alertas | Estados disponible/bajo/agotado y métricas del dashboard. |
| 5. Precios | Edición individual, porcentaje, disminución, categoría, selección, redondeo, vista previa sin cambios, aplicación confirmada y rechazo de vista previa desactualizada. |
| 6. Historial e informes | Día, semana configurable, mes, rango; límites UTC/Buenos Aires; costo histórico inalterado, historial conservado tras cambiar nombre/código y dar de baja. |
| 7. Concurrencia, copias y responsive | Operaciones simultáneas por API y sesiones SQLite independientes; 48 solicitudes concurrentes; copia, restauración, rechazo de archivo inválido o stock inconsistente; navegación móvil. |

También se verificó que una valoración de **$9.999.999.989.990.000.000,01** conserve sus centavos en la respuesta JSON.

## Recorrido manual en navegador

Se utilizó exclusivamente `artifacts/preview/inventory.db`, una base de demostración separada:

1. Abrir dashboard con productos, métricas, gráfico, reposición e historial reales.
2. Crear un producto con compra $100,10, venta $150,25, stock 10 y mínimo 3.
3. Localizarlo en el inventario y abrir el formulario de entrada.
4. Confirmar una entrada de 5: **10 → 15** unidades.
5. Confirmar una salida de 3: **15 → 12** unidades.
6. Consultar los resúmenes y comprobar su actividad en el período.
7. Generar una vista previa de aumento de venta del 15 %, confirmar y comprobar la creación del historial.
8. Crear una copia desde Configuración y comprobar que aparece el enlace de descarga.
9. Revisar el menú adaptable y navegar al inventario en celular.
10. Reiniciar con la configuración de producción y confirmar **0 productos**, sin datos ficticios.

La restauración y los casos de concurrencia se probaron automáticamente. No se realizó una restauración sobre la base de producción. Los servidores utilizados para verificación se detienen al finalizar.

La suite muestra un aviso de deprecación de Starlette sobre su adaptador de pruebas HTTPX; no hubo pruebas fallidas. No afecta la ejecución de la aplicación.

## Actualización: ganancia estimada por salida

Se añadieron pruebas para saldo positivo, negativo y cero; precisión de centavos; exclusión de entradas y ajustes; conservación del saldo tras cambiar precios o dar de baja; resúmenes por período; migración desde el esquema anterior y restauración de copias antiguas y nuevas. La vista previa en TypeScript también pasó 5 comprobaciones de precisión, incluido un importe superior al rango exacto de los números de punto flotante.
