from sqlalchemy import Table

def pick_col(table: Table, *names: str):
    """Вернёт первый существующий столбец из списка имён."""
    for n in names:
        if n in table.c:
            return table.c[n]
    return None

def pick_key(d: dict, *keys: str):
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None
