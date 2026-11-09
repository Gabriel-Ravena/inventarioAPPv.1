"""Online SQLite backups include WAL. Restore validates a copy before replacing data."""
from datetime import datetime, timezone
from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
from sqlalchemy import create_engine
from .database import upgrade_schema
from .services import fail

MAX_BACKUP = 50 * 1024 * 1024

def create_backup(db):
    name = 'inventario-' + datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S-%f') + '.sqlite3'
    target = db.backup_dir / name
    with closing(sqlite3.connect(db.path)) as source, closing(sqlite3.connect(target)) as dest:
        source.backup(dest)
    return {'name': name, 'size': target.stat().st_size, 'created_at': datetime.now(timezone.utc).isoformat()}

def backup_path(db, name):
    if Path(name).name != name or not name.startswith('inventario-') or not name.endswith('.sqlite3'):
        fail('Nombre de copia no válido.', 400)
    path = db.backup_dir / name
    if not path.is_file():
        fail('No se encontró la copia.', 404)
    return path

def restore_backup(db, content: bytes):
    if not content.startswith(b'SQLite format 3\x00'):
        fail('El archivo no es una base de datos SQLite válida.')
    with tempfile.TemporaryDirectory(dir=db.path.parent) as temp:
        path = Path(temp) / 'restore.sqlite3'
        path.write_bytes(content)
        try:
            with closing(sqlite3.connect(path)) as source:
                source.execute('PRAGMA trusted_schema=OFF')
                if source.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    fail('La copia tiene errores de integridad.')
                if source.execute('PRAGMA foreign_key_check').fetchall():
                    fail('La copia tiene referencias inválidas.')
                version = source.execute('SELECT version_num FROM alembic_version').fetchall()
                if version not in ([('0001',)], [('0002',)]):
                    fail('La versión de esta copia no es compatible.')
                expected = {'categories': {'id','name'}, 'settings': {'id','shop_name','week_start','timezone','next_code'},
                            'products': {'id','code','name','category_id','description','purchase_price','sale_price','stock','minimum_stock','active','created_at','updated_at'},
                            'movements': {'id','product_id','product_code','product_name','type','quantity','delta','stock_before','stock_after','reference_cost','note','created_at'},
                            'price_history': {'id','product_id','product_code','product_name','old_purchase','new_purchase','old_sale','new_sale','reason','created_at'}}
                if version == [('0002',)]:
                    expected['movements'].add('reference_sale_price')
                for table, columns in expected.items():
                    if {r[1] for r in source.execute(f'PRAGMA table_info({table})')} != columns:
                        fail('El esquema de la copia no es compatible.')
                if source.execute("SELECT count(*) FROM sqlite_master WHERE type IN ('trigger','view')").fetchone()[0]:
                    fail('La copia contiene objetos no admitidos.')
                settings = source.execute('SELECT id,week_start,timezone,next_code FROM settings').fetchall()
                if len(settings) != 1 or settings[0][0] != 1 or not 0 <= settings[0][1] <= 6 or settings[0][2] != 'America/Argentina/Buenos_Aires' or settings[0][3] < 1:
                    fail('La configuración de la copia no es válida.')
                if source.execute('SELECT 1 FROM products WHERE stock < 0 OR minimum_stock < 0 OR purchase_price < 0 OR sale_price < 0 LIMIT 1').fetchone():
                    fail('La copia contiene valores inválidos.')
                if source.execute("SELECT 1 FROM movements WHERE quantity <= 0 OR quantity != abs(delta) OR stock_after != stock_before + delta OR stock_before < 0 OR stock_after < 0 OR type NOT IN ('opening','in','out','adjustment') LIMIT 1").fetchone():
                    fail('La copia contiene movimientos inválidos.')
                if source.execute('SELECT p.id FROM products p LEFT JOIN movements m ON m.product_id=p.id GROUP BY p.id HAVING p.stock != COALESCE(SUM(m.delta),0) LIMIT 1').fetchone():
                    fail('El stock de la copia no coincide con su historial.')
                if version == [('0002',)] and source.execute('SELECT 1 FROM movements WHERE reference_sale_price < 0 OR (reference_sale_price IS NOT NULL AND typeof(reference_sale_price) != \'integer\') LIMIT 1').fetchone():
                    fail('La copia contiene precios de venta históricos inválidos.')
            # Upgrade the validated temporary copy before touching the live database.
            candidate_engine = create_engine('sqlite:///' + path.as_posix())
            try:
                upgrade_schema(candidate_engine)
            finally:
                candidate_engine.dispose()
            safety = create_backup(db)
            db.engine.dispose()
            with closing(sqlite3.connect(path)) as source:
                with closing(sqlite3.connect(db.path)) as dest:
                    source.backup(dest)
        except sqlite3.DatabaseError:
            fail('No se pudo leer la copia o su estructura no es compatible.')
    return {'message': 'Copia restaurada correctamente.', 'safety_backup': safety['name']}
