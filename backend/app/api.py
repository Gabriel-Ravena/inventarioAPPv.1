import os
import asyncio
import secrets
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Literal
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session
from .backups import MAX_BACKUP, backup_path, create_backup, restore_backup
from .database import BACKEND_DIR, Database, atomic
from .models import Category, Movement, PriceHistory, Product, ShopSettings, utcnow
from .schemas import BulkConfirm, BulkInput, CategoryInput, MovementInput, ProductCreate, ProductInput, SettingsInput
from .serialization import ExactMoneyRoute
from .services import ZONE, bulk_preview, date_bounds, fail, movement_dict, next_code, normalize_code, product_dict, product_or_404, record_movement, record_price, state, summarize, validate_category


def create_app(database_path: Path | None = None, serve_frontend=True):
    db = Database(database_path or Path(os.getenv('INVENTORY_DB') or str(BACKEND_DIR / 'data' / 'inventory.db')))
    app = FastAPI(title='Almacén · API de inventario', version='1.0.0')
    app.router.route_class = ExactMoneyRoute
    app.state.db = db
    maintenance = asyncio.Lock()
    origins = ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:8000', 'http://localhost:8000']
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=['GET','POST','PUT','DELETE'], allow_headers=['Content-Type','X-Inventory-Client'])

    @app.middleware('http')
    async def local_write_guard(request: Request, call_next):
        if request.method in ('POST','PUT','DELETE','PATCH') and request.url.path.startswith('/api/'):
            if request.headers.get('X-Inventory-Client') != 'web' or (request.headers.get('origin') and request.headers['origin'] not in origins):
                return JSONResponse({'detail': 'Solicitud local no autorizada.'}, status_code=403)
        return await call_next(request)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        errors = [{'field': '.'.join(str(p) for p in e['loc'][1:]), 'message': e['msg']} for e in exc.errors()]
        return JSONResponse({'detail': 'Revisá los datos ingresados. Hay valores inválidos o fuera del rango permitido.', 'errors': errors}, status_code=422)

    @app.exception_handler(IntegrityError)
    async def integrity_error(request, exc):
        return JSONResponse({'detail': 'El código o la categoría ya existe, o los datos incumplen una restricción.'}, status_code=409)

    @app.exception_handler(OperationalError)
    async def busy_error(request, exc):
        return JSONResponse({'detail': 'No se pudo acceder a la base de datos. Reintentá la operación.'}, status_code=503)

    async def session_dep():
        # One local server worker. Also gates reads while a restore replaces the database.
        async with maintenance:
            with db.sessions() as session:
                yield session

    @app.get('/api/health')
    def health():
        return {'status': 'ok', 'timezone': 'America/Argentina/Buenos_Aires'}

    @app.get('/api/categories')
    def categories(session: Session = Depends(session_dep)):
        return [{'id': c.id, 'name': c.name} for c in session.scalars(select(Category).order_by(Category.name))]

    @app.post('/api/categories', status_code=201)
    def add_category(data: CategoryInput, session: Session = Depends(session_dep)):
        with atomic(session):
            if session.scalar(select(Category.id).where(func.lower(Category.name) == data.name.casefold())):
                fail('Ya existe una categoría con ese nombre.', 409)
            category = Category(name=data.name)
            session.add(category)
            session.flush()
        return {'id': category.id, 'name': category.name}

    @app.put('/api/categories/{category_id}')
    def edit_category(category_id: int, data: CategoryInput, session: Session = Depends(session_dep)):
        with atomic(session):
            category = session.get(Category, category_id)
            if not category:
                fail('La categoría no existe.', 404)
            if session.scalar(select(Category.id).where(func.lower(Category.name) == data.name.casefold(), Category.id != category_id)):
                fail('Ya existe una categoría con ese nombre.', 409)
            category.name = data.name
        return {'id': category.id, 'name': category.name}

    @app.delete('/api/categories/{category_id}')
    def delete_category(category_id: int, session: Session = Depends(session_dep)):
        with atomic(session):
            category = session.get(Category, category_id)
            if not category:
                fail('La categoría no existe.', 404)
            if session.scalar(select(Product.id).where(Product.category_id == category_id).limit(1)):
                fail('La categoría tiene productos asociados. Reasignalos antes de eliminarla.', 409)
            session.delete(category)
        return {'message': 'Categoría eliminada.'}

    @app.get('/api/products')
    def products(q: str = '', category_id: int | None = None, status: Literal['all','available','low','out','replenish'] = 'all',
                 min_price: Decimal | None = Query(None, ge=0), max_price: Decimal | None = Query(None, ge=0),
                 sort: Literal['name','price','stock','created'] = 'name', order: Literal['asc','desc'] = 'asc',
                 page: int = Query(1, ge=1), page_size: int = Query(12, ge=1, le=100), session: Session = Depends(session_dep)):
        query = select(Product).where(Product.active.is_(True))
        if q.strip():
            query = query.where(or_(Product.name.icontains(q.strip(), autoescape=True), Product.code.icontains(q.strip(), autoescape=True)))
        if category_id is not None:
            query = query.where(Product.category_id == category_id)
        if status == 'available': query = query.where(Product.stock > 0)
        if status == 'low': query = query.where(Product.stock > 0, Product.stock <= Product.minimum_stock)
        if status == 'out': query = query.where(Product.stock == 0)
        if status == 'replenish': query = query.where(Product.stock <= Product.minimum_stock)
        if min_price is not None: query = query.where(Product.sale_price >= min_price)
        if max_price is not None: query = query.where(Product.sale_price <= max_price)
        if min_price is not None and max_price is not None and max_price < min_price:
            fail('El precio máximo debe ser mayor o igual al mínimo.')
        total = session.scalar(select(func.count()).select_from(query.subquery()))
        column = {'name': func.lower(Product.name), 'price': Product.sale_price, 'stock': Product.stock, 'created': Product.created_at}[sort]
        query = query.order_by(column.desc() if order == 'desc' else column.asc(), Product.id).offset((page-1)*page_size).limit(page_size)
        return {'items': [product_dict(session,p) for p in session.scalars(query)], 'total': total, 'page': page, 'page_size': page_size}

    @app.get('/api/products/{product_id}')
    def product(product_id: int, session: Session = Depends(session_dep)):
        return product_dict(session, product_or_404(session, product_id))

    @app.post('/api/products', status_code=201)
    def add_product(data: ProductCreate, session: Session = Depends(session_dep)):
        with atomic(session):
            validate_category(session, data.category_id)
            values = data.model_dump(exclude={'initial_stock', 'code'})
            p = Product(**values, code=normalize_code(data.code) if data.code is not None else next_code(session), stock=0)
            session.add(p)
            session.flush()
            if data.initial_stock:
                record_movement(session, p, 'opening', data.initial_stock, 'Stock inicial')
        return product_dict(session,p)

    @app.put('/api/products/{product_id}')
    def edit_product(product_id: int, data: ProductInput, session: Session = Depends(session_dep)):
        with atomic(session):
            p = product_or_404(session, product_id)
            validate_category(session, data.category_id)
            # Price audit preserves the identity/code at the time of the edit.
            record_price(session, p, data.purchase_price, data.sale_price, 'Edición individual')
            for field, value in data.model_dump(exclude={'code','purchase_price','sale_price'}).items():
                setattr(p, field, value)
            if data.code is not None:
                p.code = normalize_code(data.code)
            p.updated_at = utcnow()
        return product_dict(session,p)

    @app.delete('/api/products/{product_id}')
    def delete_product(product_id: int, session: Session = Depends(session_dep)):
        with atomic(session):
            p = product_or_404(session,product_id)
            # Always archive; even empty products retain reserved IDs and codes.
            p.active = False
            p.updated_at = utcnow()
        return {'message': 'Producto dado de baja. Su historial se conserva.'}

    @app.post('/api/movements', status_code=201)
    def add_movement(data: MovementInput, session: Session = Depends(session_dep)):
        with atomic(session):
            p = product_or_404(session,data.product_id)
            sign = -1 if data.type == 'out' or (data.type == 'adjustment' and data.direction == 'out') else 1
            m = record_movement(session, p, data.type, sign * data.quantity, data.note)
        return movement_dict(m)

    @app.get('/api/movements')
    def movements(q: str = '', product_id: int | None=None, type: Literal['all','in','out','opening','adjustment']='all',
                  start: date | None=None, end: date | None=None, page: int=Query(1,ge=1), page_size: int=Query(12,ge=1,le=100), session: Session=Depends(session_dep)):
        query = select(Movement)
        if q.strip():
            matching = select(Product.id).where(or_(Product.name.icontains(q.strip(),autoescape=True),Product.code.icontains(q.strip(),autoescape=True)))
            query = query.where(or_(Movement.product_code.icontains(q.strip(),autoescape=True),Movement.product_name.icontains(q.strip(),autoescape=True),Movement.product_id.in_(matching)))
        if product_id is not None: query = query.where(Movement.product_id == product_id)
        if type != 'all': query = query.where(Movement.type == type)
        if start and end and end < start: fail('El rango de fechas no es válido.')
        if start:
            _,_,lower,_ = date_bounds(session,'custom',start=start,end=start)
            query = query.where(Movement.created_at >= lower)
        if end:
            _,_,_,upper = date_bounds(session,'custom',start=end,end=end)
            query = query.where(Movement.created_at < upper)
        total = session.scalar(select(func.count()).select_from(query.subquery()))
        rows = session.scalars(query.order_by(Movement.created_at.desc(),Movement.id.desc()).offset((page-1)*page_size).limit(page_size))
        return {'items': [movement_dict(m) for m in rows], 'total': total, 'page':page, 'page_size':page_size}

    @app.get('/api/reports')
    def reports(period: Literal['day','week','month','custom']='day', anchor: date | None=None, start: date | None=None, end: date | None=None, session: Session=Depends(session_dep)):
        return summarize(session,period,anchor,start,end)

    @app.get('/api/dashboard')
    def dashboard(session: Session=Depends(session_dep)):
        ps = session.scalars(select(Product).where(Product.active.is_(True))).all()
        today = summarize(session)
        end = datetime.now(ZONE).date()
        week = summarize(session,'custom',start=end-timedelta(days=6),end=end)
        # Fill missing days so the chart has a stable seven-day axis.
        daily = {d['date']: d for d in week['daily']}
        chart = [daily.get((end-timedelta(days=i)).isoformat(), {'date':(end-timedelta(days=i)).isoformat(),'incoming':0,'outgoing':0}) for i in range(6,-1,-1)]
        recent = session.scalars(select(Movement).order_by(Movement.created_at.desc(),Movement.id.desc()).limit(5)).all()
        low = sorted([p for p in ps if p.stock <= p.minimum_stock],key=lambda p:(p.stock,p.name))
        return {'product_count':len(ps), 'units':sum(p.stock for p in ps), 'low_count':sum(state(p)=='low' for p in ps), 'out_count':sum(p.stock==0 for p in ps),
                'purchase_value':sum((p.stock*p.purchase_price for p in ps),Decimal(0)), 'sale_value':sum((p.stock*p.sale_price for p in ps),Decimal(0)),
                'today_incoming':today['incoming'], 'today_outgoing':today['outgoing'],
                'today_estimated_profit':today['estimated_profit'], 'today_unpriced_outgoing_count':today['unpriced_outgoing_count'], 'chart':chart,
                'replenish':[product_dict(session,p) for p in low[:5]], 'recent':[movement_dict(m) for m in recent]}

    @app.post('/api/prices/preview')
    def preview_prices(data: BulkInput, session: Session=Depends(session_dep)):
        return bulk_preview(session,data)

    @app.post('/api/prices/apply')
    def apply_prices(data: BulkConfirm, session: Session=Depends(session_dep)):
        with atomic(session):
            preview = bulk_preview(session,data)
            if not secrets.compare_digest(data.preview_token,preview['preview_token']):
                fail('Los productos cambiaron desde la vista previa. Generá una nueva antes de confirmar.',409)
            for row in preview['rows']:
                p = product_or_404(session,row['id'])
                record_price(session,p,row['new_purchase'],row['new_sale'],f'Actualización masiva ({data.percentage:+}%)')
        return {'message':f"Se procesaron {len(preview['rows'])} productos.", 'count':len(preview['rows'])}

    @app.get('/api/prices/history')
    def price_history(page: int=Query(1,ge=1), page_size: int=Query(12,ge=1,le=100), session: Session=Depends(session_dep)):
        total=session.scalar(select(func.count(PriceHistory.id)))
        rows=session.scalars(select(PriceHistory).order_by(PriceHistory.created_at.desc(),PriceHistory.id.desc()).offset((page-1)*page_size).limit(page_size))
        return {'items':[{c.name:getattr(p,c.name) for c in PriceHistory.__table__.columns} for p in rows], 'total':total, 'page':page, 'page_size':page_size}

    @app.get('/api/settings')
    def settings(session: Session=Depends(session_dep)):
        s=session.get(ShopSettings,1)
        return {'shop_name':s.shop_name,'week_start':s.week_start,'timezone':s.timezone}

    @app.put('/api/settings')
    def update_settings(data: SettingsInput, session: Session=Depends(session_dep)):
        with atomic(session):
            s=session.get(ShopSettings,1)
            s.shop_name,s.week_start=data.shop_name,data.week_start
        return {'shop_name':s.shop_name,'week_start':s.week_start,'timezone':s.timezone}

    @app.get('/api/backups')
    def backups(session: Session=Depends(session_dep)):
        return [{'name':p.name,'size':p.stat().st_size,'created_at':datetime.fromtimestamp(p.stat().st_mtime,ZONE).isoformat()} for p in sorted(db.backup_dir.glob('inventario-*.sqlite3'),reverse=True)]

    @app.post('/api/backups',status_code=201)
    def backup(session: Session=Depends(session_dep)):
        return create_backup(db)

    @app.get('/api/backups/{name}')
    def download_backup(name: str, session: Session=Depends(session_dep)):
        return FileResponse(backup_path(db,name),media_type='application/octet-stream',filename=name)

    @app.post('/api/restore')
    def restore(file: UploadFile=File(...), confirmation: str=Form(...), session: Session=Depends(session_dep)):
        if confirmation != 'RESTAURAR': fail('Escribí RESTAURAR para confirmar.')
        content=file.file.read(MAX_BACKUP+1)
        if len(content)>MAX_BACKUP: fail('La copia supera el límite de 50 MB.',413)
        return restore_backup(db,content)

    if serve_frontend:
        dist=BACKEND_DIR.parent / 'frontend' / 'dist'
        if dist.is_dir():
            app.mount('/',StaticFiles(directory=dist,html=True),name='frontend')
    return app
