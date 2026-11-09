from decimal import Decimal
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
Price = Annotated[Decimal, Field(ge=0, le=Decimal('9999999999.99'), max_digits=12, decimal_places=2)]
Units = Annotated[int, Field(strict=True, ge=0, le=1000000000)]

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class ProductInput(StrictModel):
    code: Annotated[str | None, Field(max_length=60)] = None
    name: Name
    category_id: int | None = None
    description: Annotated[str, Field(max_length=2000)] = ''
    purchase_price: Price
    sale_price: Price
    minimum_stock: Units = 0

class ProductCreate(ProductInput):
    initial_stock: Units = 0

class MovementInput(StrictModel):
    product_id: int
    type: Literal['in', 'out', 'adjustment']
    quantity: Annotated[int, Field(strict=True, gt=0, le=1000000000)]
    direction: Literal['in', 'out'] = 'in'
    note: Annotated[str, Field(max_length=500)] = ''

    @model_validator(mode='after')
    def adjustment_reason(self):
        if self.type == 'adjustment' and not self.note:
            raise ValueError('Indicá el motivo del ajuste.')
        return self

class CategoryInput(StrictModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]

class SettingsInput(StrictModel):
    shop_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    week_start: Annotated[int, Field(strict=True, ge=0, le=6)]

class BulkInput(StrictModel):
    scope: Literal['all', 'category', 'selected']
    product_ids: list[int] = Field(default_factory=list, max_length=10000)
    category_id: int | None = None
    target: Literal['purchase', 'sale', 'both'] = 'sale'
    percentage: Annotated[Decimal, Field(ge=-100, le=10000, max_digits=8, decimal_places=2)]
    rounding: Literal['0.01', '1', '10', '100'] = '0.01'

class BulkConfirm(BulkInput):
    preview_token: str
