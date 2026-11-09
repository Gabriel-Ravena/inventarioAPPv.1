"""Datos ficticios opcionales, siempre en una base distinta de producción."""
import argparse
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from sqlalchemy import select
from app.database import BACKEND_DIR, Database, atomic
from app.models import Category, Product, ShopSettings
from app.services import ZONE, record_movement

def main():
    parser=argparse.ArgumentParser(description='Crear una base de demostración independiente.')
    parser.add_argument('--db',required=True,help='Ruta de una base NUEVA, distinta de la base de producción.')
    args=parser.parse_args()
    path=Path(args.db).resolve()
    if path == (BACKEND_DIR/'data'/'inventory.db').resolve() or path.exists():
        parser.error('Elegí una base nueva. No se modifica una base existente ni la base de producción.')
    db=Database(path)
    today=datetime.now(ZONE)
    with db.sessions() as s, atomic(s):
        s.get(ShopSettings,1).shop_name='Comercio de demostración'
        categories=[Category(name=n) for n in ['Almacén','Bebidas','Limpieza','Cuidado personal']]
        s.add_all(categories);s.flush()
        entries=[('Yerba mate 1 kg',0,4200,5600,24,8),('Aceite de girasol 900 ml',0,2300,3200,5,10),('Arroz largo fino 1 kg',0,1100,1650,35,10),('Fideos tirabuzón 500 g',0,850,1300,18,6),('Café molido 250 g',0,3800,5100,12,5),('Agua mineral 1,5 l',1,650,1100,42,12),('Gaseosa cola 2,25 l',1,2200,3300,0,8),('Jugo de naranja 1 l',1,900,1500,7,10),('Detergente limón 750 ml',2,1200,1850,16,5),('Lavandina 1 l',2,750,1250,4,8),('Jabón de tocador',3,700,1150,23,6),('Champú 400 ml',3,2900,4200,11,4)]
        for i,(name,cat,purchase,sale,stock,minimum) in enumerate(entries):
            p=Product(code=f'PROD-{i+1:06d}',name=name,category_id=categories[cat].id,purchase_price=Decimal(purchase),sale_price=Decimal(sale),stock=0,minimum_stock=minimum,description='Producto ficticio de demostración')
            s.add(p);s.flush()
            m=record_movement(s,p,'opening',max(stock,12),'Apertura de demostración')
            m.created_at=(today-timedelta(days=10)).astimezone(timezone.utc).isoformat()
            for day in range(6,-1,-1):
                incoming=(i+day)%5+1
                outgoing=incoming+((i+day)%3-1)
                stamp=today-timedelta(days=day)
                for kind,delta in [('in',incoming),('out',-outgoing)]:
                    if delta:
                        m=record_movement(s,p,kind,delta,'Movimiento ficticio')
                        m.created_at=stamp.replace(hour=10 if kind=='in' else 14,minute=i).astimezone(timezone.utc).isoformat()
            difference=stock-p.stock
            if difference: record_movement(s,p,'adjustment',difference,'Conteo ficticio de demostración')
        s.get(ShopSettings,1).next_code=len(entries)+1
    db.engine.dispose()
    print(f'Base de demostración creada: {path}')

if __name__=='__main__': main()
