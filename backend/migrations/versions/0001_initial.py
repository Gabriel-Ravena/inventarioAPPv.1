"""Esquema inicial, con importes monetarios almacenados en centavos."""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('categories', sa.Column('id', sa.Integer, primary_key=True), sa.Column('name', sa.String(80), nullable=False, unique=True))
    op.create_table('settings', sa.Column('id', sa.Integer, primary_key=True), sa.Column('shop_name', sa.String(100), nullable=False), sa.Column('week_start', sa.Integer, nullable=False), sa.Column('timezone', sa.String(60), nullable=False), sa.Column('next_code', sa.Integer, nullable=False), sa.CheckConstraint('week_start BETWEEN 0 AND 6'), sa.CheckConstraint('next_code > 0'))
    op.create_table('products', sa.Column('id', sa.Integer, primary_key=True, autoincrement=True), sa.Column('code', sa.String(60), nullable=False, unique=True), sa.Column('name', sa.String(160), nullable=False), sa.Column('category_id', sa.Integer, sa.ForeignKey('categories.id')), sa.Column('description', sa.Text, nullable=False), sa.Column('purchase_price', sa.Integer, nullable=False), sa.Column('sale_price', sa.Integer, nullable=False), sa.Column('stock', sa.Integer, nullable=False), sa.Column('minimum_stock', sa.Integer, nullable=False), sa.Column('active', sa.Boolean, nullable=False), sa.Column('created_at', sa.String(40), nullable=False), sa.Column('updated_at', sa.String(40), nullable=False), sa.CheckConstraint('stock >= 0 AND minimum_stock >= 0'), sa.CheckConstraint('purchase_price >= 0 AND sale_price >= 0'), sqlite_autoincrement=True)
    op.create_index('ix_products_name', 'products', ['name'])
    op.create_index('ix_products_category_id', 'products', ['category_id'])
    op.create_index('ix_products_active', 'products', ['active'])
    op.create_table('movements', sa.Column('id', sa.Integer, primary_key=True), sa.Column('product_id', sa.Integer, sa.ForeignKey('products.id'), nullable=False), sa.Column('product_code', sa.String(60), nullable=False), sa.Column('product_name', sa.String(160), nullable=False), sa.Column('type', sa.String(20), nullable=False), sa.Column('quantity', sa.Integer, nullable=False), sa.Column('delta', sa.Integer, nullable=False), sa.Column('stock_before', sa.Integer, nullable=False), sa.Column('stock_after', sa.Integer, nullable=False), sa.Column('reference_cost', sa.Integer, nullable=False), sa.Column('note', sa.String(500), nullable=False), sa.Column('created_at', sa.String(40), nullable=False), sa.CheckConstraint('quantity > 0'), sa.CheckConstraint('stock_before >= 0 AND stock_after >= 0'), sa.CheckConstraint("type IN ('opening','in','out','adjustment')"), sa.CheckConstraint('stock_after = stock_before + delta'), sa.CheckConstraint('quantity = abs(delta)'))
    op.create_index('ix_movements_product_id', 'movements', ['product_id'])
    op.create_index('ix_movements_type', 'movements', ['type'])
    op.create_index('ix_movements_period', 'movements', ['created_at', 'product_id'])
    op.create_table('price_history', sa.Column('id', sa.Integer, primary_key=True), sa.Column('product_id', sa.Integer, sa.ForeignKey('products.id'), nullable=False), sa.Column('product_code', sa.String(60), nullable=False), sa.Column('product_name', sa.String(160), nullable=False), sa.Column('old_purchase', sa.Integer, nullable=False), sa.Column('new_purchase', sa.Integer, nullable=False), sa.Column('old_sale', sa.Integer, nullable=False), sa.Column('new_sale', sa.Integer, nullable=False), sa.Column('reason', sa.String(100), nullable=False), sa.Column('created_at', sa.String(40), nullable=False))
    op.create_index('ix_price_history_product_id', 'price_history', ['product_id'])
    op.create_index('ix_price_history_created_at', 'price_history', ['created_at'])

def downgrade():
    for table in ['price_history', 'movements', 'products', 'settings', 'categories']:
        op.drop_table(table)
