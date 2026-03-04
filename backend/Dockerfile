FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && if [ \"${AUTO_SEED_DEMO:-false}\" = \"true\" ]; then python scripts/seed_demo.py; fi && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
