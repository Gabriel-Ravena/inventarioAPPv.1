from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
from contextlib import closing
import sqlite3
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.api import create_app
from app.database import atomic
from app.models import Movement, Product
from app.services import record_movement

@pytest.fixture
def client(tmp_path):
    app=create_app(tmp_path/'test.db',serve_frontend=False)
    with TestClient(app,headers={'X-Inventory-Client':'web'}) as client:
        yield client
    app.state.db.engine.dispose()

def add(client, **overrides):
    response=client.post('/api/products',json={'name':'Yerba mate','purchase_price':'100.10','sale_price':'150.25','initial_stock':10,'minimum_stock':3,**overrides})
    assert response.status_code == 201, response.text
    return response.json()

def move(client,p,kind='in',quantity=5,**kw):
    return client.post('/api/movements',json={'product_id':p['id'],'type':kind,'quantity':quantity,**kw})

def update(client,p,**kw):
    return client.put(f"/api/products/{p['id']}",json={k:p[k] for k in ['code','name','category_id','description','purchase_price','sale_price','minimum_stock']}|kw)

def test_product_create_edit_and_opening(client):
    p=add(client,code='beb-001')
    assert p['code']=='BEB-001' and p['stock']==10
    edited=update(client,p,name='Yerba nueva',code='YER-22').json()
    assert edited['id']==p['id'] and edited['code']=='YER-22'
    rows=client.get('/api/movements').json()['items']
    assert rows[0]['type']=='opening' and rows[0]['product_code']=='BEB-001'
    assert rows[0]['product_name']=='Yerba mate' and rows[0]['stock_before']==0
    assert client.get('/api/movements',params={'q':'YER-22'}).json()['total']==1

def test_unique_manual_and_automatic_codes(client):
    add(client,code='PROD-000001')
    p=add(client)
    assert p['code']=='PROD-000002'
    assert client.post('/api/products',json={'name':'Duplicado','code':'prod-000001','purchase_price':1,'sale_price':1}).status_code==409
    client.delete(f"/api/products/{p['id']}")
    assert add(client)['code']=='PROD-000003'

def test_search_filters_and_categories(client):
    cat=client.post('/api/categories',json={'name':'Almacén'}).json()
    add(client,category_id=cat['id'])
    add(client,name='Aceite',code='ACE-001',initial_stock=0,sale_price='200')
    assert client.get('/api/products',params={'q':'mate','category_id':cat['id']}).json()['total']==1
    assert client.get('/api/products',params={'q':'CE-0'}).json()['total']==1
    assert client.get('/api/products',params={'status':'out'}).json()['total']==1
    assert client.get('/api/products',params={'min_price':160,'max_price':250}).json()['total']==1
    assert client.get('/api/products',params={'sort':'stock','order':'desc','page_size':1}).json()['items'][0]['stock']==10
    assert client.delete(f"/api/categories/{cat['id']}").status_code==409

def test_entries_exits_and_adjustment(client):
    p=add(client)
    m=move(client,p).json()
    assert (m['stock_before'],m['stock_after'])==(10,15)
    assert move(client,p,'out',12).json()['stock_after']==3
    assert client.get(f"/api/products/{p['id']}").json()['status']=='low'
    assert move(client,p,'out',3).json()['stock_after']==0
    assert client.get(f"/api/products/{p['id']}").json()['status']=='out'
    assert move(client,p,'adjustment',2,direction='in',note='Corrección de conteo').json()['stock_after']==2
    assert move(client,p,'adjustment',1).status_code==422
    assert client.get('/api/movements').json()['total']==5

@pytest.mark.parametrize('quantity',[0,-1,1.5,'2',True])
def test_invalid_quantities(client,quantity):
    p=add(client)
    assert move(client,p,quantity=quantity).status_code==422
    assert client.get(f"/api/products/{p['id']}").json()['stock']==10

def test_insufficient_stock_is_atomic(client):
    p=add(client)
    assert move(client,p,'out',11).status_code==409
    assert client.get(f"/api/products/{p['id']}").json()['stock']==10
    assert client.get('/api/movements').json()['total']==1

def test_individual_and_bulk_prices_are_exact(client):
    p=add(client,purchase_price='0.10',sale_price='2000')
    assert update(client,p,purchase_price='0.20').status_code==200
    request={'scope':'selected','product_ids':[p['id']],'percentage':'15','target':'sale','rounding':'1'}
    preview=client.post('/api/prices/preview',json=request).json()
    assert Decimal(str(preview['rows'][0]['new_sale']))==2300
    assert Decimal(client.get(f"/api/products/{p['id']}").json()['sale_price'])==2000
    assert client.post('/api/prices/apply',json=request|{'preview_token':preview['preview_token']}).status_code==200
    assert Decimal(client.get(f"/api/products/{p['id']}").json()['sale_price'])==2300
    assert client.get('/api/prices/history').json()['total']==2
    report=client.get('/api/reports').json()
    assert Decimal(str(report['opening_value']))==Decimal('1.00')

def test_stale_bulk_preview_is_rejected(client):
    p=add(client)
    request={'scope':'all','percentage':10,'target':'both'}
    preview=client.post('/api/prices/preview',json=request).json()
    update(client,p,sale_price=300)
    assert client.post('/api/prices/apply',json=request|{'preview_token':preview['preview_token']}).status_code==409

def test_price_rounding_decrease_and_category(client):
    cat=client.post('/api/categories',json={'name':'Bebidas'}).json()
    p=add(client,category_id=cat['id'],sale_price='199.99')
    other=add(client)
    req={'scope':'category','category_id':cat['id'],'percentage':-10,'target':'sale','rounding':'10'}
    preview=client.post('/api/prices/preview',json=req).json()
    assert preview['count']==1 and Decimal(preview['rows'][0]['new_sale'])==180
    assert client.post('/api/prices/apply',json=req|{'preview_token':preview['preview_token']}).status_code==200
    assert client.get(f"/api/products/{other['id']}").json()['sale_price']==other['sale_price']

def test_summaries_timezone_week_month_and_reference_cost(client):
    p=add(client,initial_stock=0)
    assert move(client,p,'in',7).status_code==201
    assert move(client,p,'out',2).status_code==201
    with client.app.state.db.sessions() as s, atomic(s):
        rows=s.scalars(select(Movement).order_by(Movement.id)).all()
        # UTC 02:30 belongs to the preceding day in Buenos Aires.
        rows[0].created_at='2026-11-10T02:30:00+00:00'
        rows[1].created_at='2026-11-10T03:30:00+00:00'
    update(client,p,purchase_price=999)
    day=client.get('/api/reports',params={'period':'day','anchor':'2026-11-09'}).json()
    assert day['incoming']==7 and day['outgoing']==0
    assert Decimal(str(day['incoming_value']))==Decimal('700.70')
    week=client.get('/api/reports',params={'period':'week','anchor':'2026-11-10'}).json()
    assert week['start']=='2026-11-09' and week['net']==5
    client.put('/api/settings',json={'shop_name':'Mi comercio','week_start':6})
    assert client.get('/api/reports',params={'period':'week','anchor':'2026-11-10'}).json()['start']=='2026-11-08'
    assert client.get('/api/reports',params={'period':'month','anchor':'2026-11-01'}).json()['net']==5
    assert client.get('/api/reports',params={'period':'custom','start':'2026-11-09','end':'2026-11-10'}).json()['outgoing']==2
    assert client.get('/api/reports',params={'period':'custom','start':'2026-11-10','end':'2026-11-09'}).status_code==400

def test_history_survives_archive(client):
    p=add(client)
    move(client,p,'out',1)
    assert client.delete(f"/api/products/{p['id']}").status_code==200
    assert client.get('/api/products').json()['total']==0
    assert client.get('/api/movements').json()['total']==2
    assert move(client,p).status_code==404

def test_concurrent_withdrawals_no_negative_stock(client):
    p=add(client,initial_stock=10)
    with ThreadPoolExecutor(max_workers=8) as pool:
        codes=list(pool.map(lambda _:move(client,p,'out',1).status_code,range(20)))
    assert codes.count(201)==10 and codes.count(409)==10
    assert client.get(f"/api/products/{p['id']}").json()['stock']==0
    assert client.get('/api/movements').json()['total']==11

def test_database_transactions_protect_independent_sessions(client):
    p=add(client,initial_stock=10)
    db=client.app.state.db
    def withdraw(_):
        try:
            with db.sessions() as session, atomic(session):
                product=session.get(Product,p['id'])
                record_movement(session,product,'out',-1)
            return True
        except Exception as exc:
            assert getattr(exc,'status_code',None)==409
            return False
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(withdraw,range(20)))==10
    assert client.get(f"/api/products/{p['id']}").json()['stock']==0

def test_concurrent_auto_codes(client):
    with ThreadPoolExecutor(max_workers=8) as pool:
        ps=list(pool.map(lambda _:add(client,initial_stock=0),range(12)))
    assert len({p['code'] for p in ps})==12

def test_backup_restore_and_invalid_file(client):
    p=add(client)
    backup=client.post('/api/backups').json()
    content=client.get('/api/backups/'+backup['name']).content
    move(client,p,'in',4)
    assert client.post('/api/restore',data={'confirmation':'NO'},files={'file':('backup.db',content)}).status_code==400
    assert client.post('/api/restore',data={'confirmation':'RESTAURAR'},files={'file':('bad.db',b'invalid')}).status_code==400
    response=client.post('/api/restore',data={'confirmation':'RESTAURAR'},files={'file':('backup.db',content)})
    assert response.status_code==200,response.text
    assert client.get(f"/api/products/{p['id']}").json()['stock']==10
    assert len(client.get('/api/backups').json())==2
    assert client.get('/api/movements').json()['total']==1

def test_dashboard_exact_values_and_write_guard(client):
    add(client,purchase_price='0.10',sale_price='0.30',initial_stock=3)
    dash=client.get('/api/dashboard').json()
    assert Decimal(str(dash['purchase_value']))==Decimal('0.30')
    assert dash['low_count']==1 and dash['out_count']==0
    assert dash['today_incoming']==0 and len(dash['chart'])==7
    assert client.post('/api/categories',json={'name':'X'},headers={'Origin':'https://untrusted.example'}).status_code==403

def test_large_valuations_preserve_every_cent(client):
    add(client,purchase_price='9999999999.99',sale_price='9999999999.99',initial_stock=999999999)
    dash=client.get('/api/dashboard').json()
    assert dash['purchase_value']=='9999999989990000000.01'

def test_unicode_search_and_category_unique(client):
    add(client,name='ÁRBOL de té')
    assert client.get('/api/products',params={'q':'árbol'}).json()['total']==1
    assert client.post('/api/categories',json={'name':'ÁREA'}).status_code==201
    assert client.post('/api/categories',json={'name':'área'}).status_code==409

def test_more_requests_than_thread_pool_do_not_deadlock(client):
    p=add(client,initial_stock=5)
    with ThreadPoolExecutor(max_workers=48) as pool:
        codes=list(pool.map(lambda _:move(client,p,'out',1).status_code,range(48)))
    assert codes.count(201)==5 and codes.count(409)==43

def test_restore_rejects_inconsistent_history_without_changing_data(client,tmp_path):
    p=add(client)
    backup=client.post('/api/backups').json()
    content=client.get('/api/backups/'+backup['name']).content
    bad=tmp_path/'inconsistent.db'
    bad.write_bytes(content)
    with closing(sqlite3.connect(bad)) as connection:
        connection.execute('UPDATE products SET stock=9')
        connection.commit()
    response=client.post('/api/restore',data={'confirmation':'RESTAURAR'},files={'file':('bad.db',bad.read_bytes())})
    assert response.status_code==400
    assert client.get(f"/api/products/{p['id']}").json()['stock']==10
    assert len(client.get('/api/backups').json())==1

def test_report_extreme_dates_are_validated(client):
    assert client.get('/api/reports',params={'period':'week','anchor':'0001-01-01'}).status_code==400
    assert client.get('/api/reports',params={'period':'month','anchor':'9999-12-31'}).status_code==400

def test_data_and_migration_survive_restart(client):
    p=add(client)
    path=client.app.state.db.path
    client.app.state.db.engine.dispose()
    second_app=create_app(path,serve_frontend=False)
    with TestClient(second_app,headers={'X-Inventory-Client':'web'}) as second:
        assert second.get(f"/api/products/{p['id']}").json()['stock']==10
        assert second.get('/api/movements').json()['total']==1
        assert add(second)['code']=='PROD-000002'
    second_app.state.db.engine.dispose()

@pytest.mark.parametrize('purchase,sale,quantity,profit',[
    ('100.10','150.25',3,'150.45'),
    ('150.25','100.10',2,'-100.30'),
    ('100.10','100.10',2,'0.00'),
    ('0.00','0.10',3,'0.30'),
])
def test_profit_per_outgoing_is_exact(client,purchase,sale,quantity,profit):
    p=add(client,purchase_price=purchase,sale_price=sale)
    m=move(client,p,'out',quantity).json()
    assert m['reference_cost']==purchase
    assert m['reference_sale_price']==sale
    assert m['estimated_profit']==profit
    assert client.get('/api/reports').json()['estimated_profit']==profit
    assert client.get('/api/dashboard').json()['today_estimated_profit']==profit

def test_profit_history_preserved_after_price_edit_and_archive(client):
    p=add(client)
    first=move(client,p,'out',2).json()
    p=update(client,p,purchase_price='200.00',sale_price='400.00').json()
    second=move(client,p,'out',1).json()
    assert first['estimated_profit']=='100.30'
    assert second['estimated_profit']=='200.00'
    client.delete(f"/api/products/{p['id']}")
    history=client.get('/api/movements',params={'type':'out'}).json()['items']
    assert [m['estimated_profit'] for m in history]==['200.00','100.30']
    report=client.get('/api/reports').json()
    assert report['estimated_profit']=='300.30'
    assert report['products'][0]['estimated_profit']=='300.30'

def test_profit_excludes_adjustments_and_unknown_legacy_prices(client):
    p=add(client)
    move(client,p,'in',3)
    move(client,p,'adjustment',2,direction='out',note='Conteo')
    legacy=move(client,p,'out',1).json()
    with client.app.state.db.sessions() as s, atomic(s):
        s.get(Movement,legacy['id']).reference_sale_price=None
    move(client,p,'out',2)
    report=client.get('/api/reports').json()
    assert report['estimated_profit']=='100.30'
    assert report['unpriced_outgoing_count']==1
    assert report['products'][0]['unpriced_outgoing_count']==1
    rows=client.get('/api/movements').json()['items']
    assert all(m['estimated_profit'] is None for m in rows if m['type']!='out' or m['id']==legacy['id'])

def test_profit_summary_uses_selected_period(client):
    p=add(client)
    first=move(client,p,'out',2).json()
    second=move(client,p,'out',1).json()
    with client.app.state.db.sessions() as s, atomic(s):
        s.get(Movement,first['id']).created_at='2026-11-09T14:00:00+00:00'
        s.get(Movement,second['id']).created_at='2026-11-10T14:00:00+00:00'
    assert client.get('/api/reports',params={'anchor':'2026-11-09'}).json()['estimated_profit']=='100.30'
    assert client.get('/api/reports',params={'period':'week','anchor':'2026-11-09'}).json()['estimated_profit']=='150.45'

def test_legacy_migration_and_backup_restore_preserve_unknown_profits(client,tmp_path):
    from alembic import command
    from alembic.config import Config
    from app.database import BACKEND_DIR
    p=add(client)
    move(client,p,'out',2)
    db=client.app.state.db
    cfg=Config(str(BACKEND_DIR/'alembic.ini'))
    cfg.set_main_option('script_location',str(BACKEND_DIR/'migrations'))
    with db.engine.begin() as connection:
        cfg.attributes['connection']=connection
        command.downgrade(cfg,'0001')
    legacy_path=tmp_path/'legacy.sqlite3'
    with closing(sqlite3.connect(db.path)) as source, closing(sqlite3.connect(legacy_path)) as dest:
        source.backup(dest)
    restarted=create_app(db.path,serve_frontend=False)
    with TestClient(restarted,headers={'X-Inventory-Client':'web'}) as other:
        old=other.get('/api/movements',params={'type':'out'}).json()['items'][0]
        assert old['estimated_profit'] is None and old['reference_sale_price'] is None
        assert move(other,p,'out',1).json()['estimated_profit']=='50.15'
        response=other.post('/api/restore',data={'confirmation':'RESTAURAR'},files={'file':('legacy.sqlite3',legacy_path.read_bytes())})
        assert response.status_code==200,response.text
        assert other.get(f"/api/products/{p['id']}").json()['stock']==8
        assert other.get('/api/reports').json()['unpriced_outgoing_count']==1
        assert move(other,p,'out',1).json()['estimated_profit']=='50.15'
    restarted.state.db.engine.dispose()

def test_backup_keeps_profit_snapshots(client):
    p=add(client)
    move(client,p,'out',3)
    backup=client.post('/api/backups').json()
    content=client.get('/api/backups/'+backup['name']).content
    update(client,p,purchase_price='999.99',sale_price='0.01')
    response=client.post('/api/restore',data={'confirmation':'RESTAURAR'},files={'file':('backup.db',content)})
    assert response.status_code==200,response.text
    assert client.get('/api/reports').json()['estimated_profit']=='150.45'

@pytest.mark.parametrize('field,value',[('purchase_price',-1),('sale_price','0.001'),('name','  '),('initial_stock',-1),('minimum_stock',1.2)])
def test_invalid_product(client,field,value):
    data={'name':'Prueba','purchase_price':1,'sale_price':2,field:value}
    assert client.post('/api/products',json=data).status_code==422
