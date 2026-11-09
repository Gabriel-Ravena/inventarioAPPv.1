from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from .models import Category, Movement, PriceHistory, Product, ShopSettings, utcnow
from .schemas import BulkInput

ZONE = ZoneInfo('America/Argentina/Buenos_Aires')
CENT = Decimal('0.01')

def fail(message: str, status=400):
    raise HTTPException(status, message)

def product_or_404(session: Session, product_id: int):
    product = session.get(Product, product_id)
    if not product or not product.active:
        fail('No se encontró el producto activo.', 404)
    return product

def normalize_code(code: str) -> str:
    code = code.strip().upper()
    if not code:
        fail('Ingresá un código o elegí la generación automática.')
    if len(code) > 60:
        fail('El código normalizado no puede superar los 60 caracteres.')
    return code

def next_code(session: Session):
    settings = session.get(ShopSettings, 1)
    while True:
        code = f'PROD-{settings.next_code:06d}'
        settings.next_code += 1
        if not session.scalar(select(Product.id).where(Product.code == code)):
            return code

def validate_category(session, category_id):
    if category_id is not None and not session.get(Category, category_id):
        fail('La categoría no existe.')

def state(product: Product):
    return 'out' if product.stock == 0 else 'low' if product.stock <= product.minimum_stock else 'normal'

def product_dict(session, product):
    category = session.get(Category, product.category_id) if product.category_id else None
    difference = product.sale_price - product.purchase_price
    margin = difference / product.sale_price * 100 if product.sale_price else Decimal(0)
    return {**{c.name: getattr(product, c.name) for c in Product.__table__.columns},
            'category': category.name if category else 'Sin categoría', 'status': state(product),
            'price_difference': difference, 'gross_margin': margin.quantize(CENT),
            'purchase_value': product.purchase_price * product.stock, 'sale_value': product.sale_price * product.stock}

def record_movement(session, product, kind, delta, note=''):
    previous = product.stock
    updated = previous + delta
    if updated < 0:
        fail(f'Stock insuficiente. Hay {previous} unidades disponibles.', 409)
    if updated > 1000000000:
        fail('El stock supera el máximo permitido de 1.000.000.000 unidades.')
    movement = Movement(product_id=product.id, product_code=product.code, product_name=product.name,
                        type=kind, quantity=abs(delta), delta=delta, stock_before=previous,
                        stock_after=updated, reference_cost=product.purchase_price,
                        reference_sale_price=product.sale_price if kind == 'out' else None, note=note)
    product.stock = updated
    product.updated_at = utcnow()
    session.add(movement)
    session.flush()
    return movement

def movement_dict(m):
    return {**{c.name: getattr(m, c.name) for c in Movement.__table__.columns},
            'estimated_profit': movement_profit(m)}

def movement_profit(m):
    if m.type != 'out' or m.reference_sale_price is None:
        return None
    return (m.reference_sale_price - m.reference_cost) * m.quantity

def record_price(session, product, purchase, sale, reason):
    if purchase == product.purchase_price and sale == product.sale_price:
        return
    session.add(PriceHistory(product_id=product.id, product_code=product.code, product_name=product.name,
                old_purchase=product.purchase_price, new_purchase=purchase, old_sale=product.sale_price,
                new_sale=sale, reason=reason))
    product.purchase_price, product.sale_price = purchase, sale
    product.updated_at = utcnow()

def date_bounds(session, period='day', anchor: date | None=None, start: date | None=None, end: date | None=None):
    anchor = anchor or datetime.now(ZONE).date()
    if any(d is not None and not 1900 <= d.year <= 9998 for d in (anchor,start,end)):
        fail('Seleccioná fechas entre los años 1900 y 9998.')
    if period == 'day':
        start, end = anchor, anchor
    elif period == 'week':
        offset = session.get(ShopSettings, 1).week_start
        start = anchor - timedelta(days=(anchor.weekday() - offset) % 7)
        end = start + timedelta(days=6)
    elif period == 'month':
        start = anchor.replace(day=1)
        next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        end = next_month - timedelta(days=1)
    elif period != 'custom' or start is None or end is None:
        fail('Seleccioná un período y ambas fechas para un rango personalizado.')
    if end < start:
        fail('La fecha final debe ser igual o posterior a la inicial.')
    try:
        lower = datetime.combine(start, time.min, ZONE).astimezone(timezone.utc).isoformat()
        upper = datetime.combine(end + timedelta(days=1), time.min, ZONE).astimezone(timezone.utc).isoformat()
    except (OverflowError, ValueError):
        fail('El rango de fechas no es válido.')
    return start, end, lower, upper

def summarize(session, period='day', anchor=None, start=None, end=None):
    start, end, lower, upper = date_bounds(session, period, anchor, start, end)
    movements = session.scalars(select(Movement).where(Movement.created_at >= lower, Movement.created_at < upper).order_by(Movement.created_at, Movement.id)).all()
    groups, days = {}, {}
    totals = {'incoming': 0, 'outgoing': 0, 'adjustment_net': 0, 'opening': 0, 'incoming_value': Decimal(0), 'outgoing_value': Decimal(0), 'adjustment_value': Decimal(0), 'opening_value': Decimal(0),
              'estimated_profit': Decimal(0), 'unpriced_outgoing_count': 0}
    for m in movements:
        group = groups.setdefault(m.product_id, {'product_id': m.product_id, 'code': m.product_code, 'name': m.product_name, 'incoming': 0, 'outgoing': 0, 'adjustment_net': 0, 'opening': 0, 'incoming_value': Decimal(0), 'outgoing_value': Decimal(0),
                                                'estimated_profit': Decimal(0), 'unpriced_outgoing_count': 0})
        day = datetime.fromisoformat(m.created_at).astimezone(ZONE).date().isoformat()
        bucket = days.setdefault(day, {'date': day, 'incoming': 0, 'outgoing': 0})
        if m.type in ('in', 'out'):
            key = 'incoming' if m.type == 'in' else 'outgoing'
            totals[key] += m.quantity
            totals[key + '_value'] += m.reference_cost * m.quantity
            group[key] += m.quantity
            group[key + '_value'] += m.reference_cost * m.quantity
            bucket[key] += m.quantity
            if m.type == 'out':
                profit = movement_profit(m)
                if profit is None:
                    totals['unpriced_outgoing_count'] += 1
                    group['unpriced_outgoing_count'] += 1
                else:
                    totals['estimated_profit'] += profit
                    group['estimated_profit'] += profit
        elif m.type == 'opening':
            totals['opening'] += m.quantity
            totals['opening_value'] += m.reference_cost * m.quantity
            group['opening'] += m.quantity
        else:
            totals['adjustment_net'] += m.delta
            totals['adjustment_value'] += m.reference_cost * m.delta
            group['adjustment_net'] += m.delta
    return {**totals, 'net': totals['incoming'] - totals['outgoing'], 'start': start, 'end': end,
            'movement_count': len(movements), 'products': list(groups.values()), 'daily': list(days.values()),
            'top_outgoing': sorted([g for g in groups.values() if g['outgoing']], key=lambda g: -g['outgoing'])[:5],
            'top_incoming': sorted([g for g in groups.values() if g['incoming']], key=lambda g: -g['incoming'])[:5]}

def bulk_preview(session, data: BulkInput):
    query = select(Product).where(Product.active.is_(True))
    if data.scope == 'category':
        if data.category_id is None:
            fail('Elegí una categoría.')
        validate_category(session, data.category_id)
        query = query.where(Product.category_id == data.category_id)
    elif data.scope == 'selected':
        if not data.product_ids:
            fail('Seleccioná al menos un producto.')
        query = query.where(Product.id.in_(data.product_ids))
    products = session.scalars(query.order_by(Product.id)).all()
    if data.scope == 'selected' and len(products) != len(set(data.product_ids)):
        fail('La selección contiene productos que ya no están activos.', 409)
    if not products:
        fail('No hay productos para actualizar.')
    step = Decimal(data.rounding)
    factor = 1 + data.percentage / 100
    def calculate(price):
        new = ((price * factor / step).quantize(Decimal('1'), rounding=ROUND_HALF_UP) * step).quantize(CENT)
        if new > Decimal('9999999999.99'):
            fail('El resultado supera el precio máximo permitido.')
        return new
    rows = [{'id': p.id, 'code': p.code, 'name': p.name, 'old_purchase': p.purchase_price,
             'old_sale': p.sale_price, 'new_purchase': calculate(p.purchase_price) if data.target in ('both', 'purchase') else p.purchase_price,
             'new_sale': calculate(p.sale_price) if data.target in ('both', 'sale') else p.sale_price,
             'updated_at': p.updated_at} for p in products]
    request_data = data.model_dump(exclude={'preview_token'}, mode='json')
    payload = json.dumps({'request': request_data, 'rows': rows}, default=str, sort_keys=True)
    token = hashlib.sha256(payload.encode()).hexdigest()
    return {'rows': rows, 'preview_token': token, 'count': len(rows)}
