"""Precio de venta histórico para calcular la ganancia estimada de cada salida.

Las salidas previas quedan en NULL: no se inventa un precio histórico.
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('movements', sa.Column(
        'reference_sale_price', sa.Integer,
        sa.CheckConstraint('reference_sale_price >= 0', name='ck_movement_sale_price_nonnegative'),
        nullable=True,
    ))


def downgrade():
    # Supported by SQLite bundled with Python 3.11+ on Windows. Preserve all
    # original table constraints instead of recreating a reflected table.
    op.drop_column('movements', 'reference_sale_price')
