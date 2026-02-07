from math import ceil

def drf_page(*, items: list, total: int, limit: int, offset: int, path: str):
    next_offset = offset + limit
    prev_offset = max(0, offset - limit)

    next_url = f"{path}?limit={limit}&offset={next_offset}" if next_offset < total else None
    prev_url = f"{path}?limit={limit}&offset={prev_offset}" if offset > 0 else None

    return {
        "count": total,
        "next": next_url,
        "previous": prev_url,
        "results": items,
    }
