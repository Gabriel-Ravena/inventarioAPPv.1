"""Keep decimal amounts exact on the JSON boundary, including large valuations."""
from decimal import Decimal
from functools import wraps
from fastapi.routing import APIRoute

def exact_decimals(value):
    if isinstance(value, Decimal):
        return format(value, '.2f')
    if isinstance(value, dict):
        return {key: exact_decimals(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [exact_decimals(item) for item in value]
    return value

class ExactMoneyRoute(APIRoute):
    def __init__(self, path, endpoint, **kwargs):
        @wraps(endpoint)
        def exact_endpoint(*args, **kw):
            return exact_decimals(endpoint(*args, **kw))
        super().__init__(path, exact_endpoint, **kwargs)
