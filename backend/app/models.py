"""Importes exactos: Decimal en Python, centavos enteros en SQLite."""
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class Money(TypeDecorator):
    impl = Integer
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return None if value is None else int((Decimal(str(value)) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))

    def process_result_value(self, value, dialect):
        return None if value is None else Decimal(value) / 100


class Base(DeclarativeBase):
    pass


class Category(Base):
    __tablename__ = 'categories'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)


class Product(Base):
    __tablename__ = 'products'
    __table_args__ = (CheckConstraint('stock >= 0'), CheckConstraint('minimum_stock >= 0'), CheckConstraint('purchase_price >= 0'), CheckConstraint('sale_price >= 0'), Index('ix_products_name', 'name'))
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    category_id: Mapped[int | None] = mapped_column(ForeignKey('categories.id'), index=True)
    description: Mapped[str] = mapped_column(Text, default='')
    purchase_price: Mapped[Decimal] = mapped_column(Money)
    sale_price: Mapped[Decimal] = mapped_column(Money)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    minimum_stock: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[str] = mapped_column(String(40), default=utcnow)
    updated_at: Mapped[str] = mapped_column(String(40), default=utcnow)


class Movement(Base):
    __tablename__ = 'movements'
    __table_args__ = (CheckConstraint('quantity > 0'), CheckConstraint('stock_before >= 0 AND stock_after >= 0'), CheckConstraint("type IN ('opening','in','out','adjustment')"), Index('ix_movements_period', 'created_at', 'product_id'))
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), index=True)
    product_code: Mapped[str] = mapped_column(String(60))
    product_name: Mapped[str] = mapped_column(String(160))
    type: Mapped[str] = mapped_column(String(20), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    delta: Mapped[int] = mapped_column(Integer)
    stock_before: Mapped[int] = mapped_column(Integer)
    stock_after: Mapped[int] = mapped_column(Integer)
    reference_cost: Mapped[Decimal] = mapped_column(Money)
    reference_sale_price: Mapped[Decimal | None] = mapped_column(Money, nullable=True)
    note: Mapped[str] = mapped_column(String(500), default='')
    created_at: Mapped[str] = mapped_column(String(40), default=utcnow)


class PriceHistory(Base):
    __tablename__ = 'price_history'
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), index=True)
    product_code: Mapped[str] = mapped_column(String(60))
    product_name: Mapped[str] = mapped_column(String(160))
    old_purchase: Mapped[Decimal] = mapped_column(Money)
    new_purchase: Mapped[Decimal] = mapped_column(Money)
    old_sale: Mapped[Decimal] = mapped_column(Money)
    new_sale: Mapped[Decimal] = mapped_column(Money)
    reason: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[str] = mapped_column(String(40), default=utcnow, index=True)


class ShopSettings(Base):
    __tablename__ = 'settings'
    id: Mapped[int] = mapped_column(primary_key=True)
    shop_name: Mapped[str] = mapped_column(String(100), default='Mi comercio')
    week_start: Mapped[int] = mapped_column(Integer, default=0)
    timezone: Mapped[str] = mapped_column(String(60), default='America/Argentina/Buenos_Aires')
    next_code: Mapped[int] = mapped_column(Integer, default=1)
