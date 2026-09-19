FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim AS runtime
WORKDIR /app
# La base python:3.12-slim arrastra 3 CVE CRITICAL en perl-base, ya
# corregidas en el repositorio de Debian: se actualizan los paquetes del
# sistema antes de crear el usuario.
RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system app && adduser --system --ingroup app --home /home/app app
COPY --from=builder --chown=app:app /root/.local /home/app/.local
COPY --chown=app:app app ./app
ENV PATH=/home/app/.local/bin:$PATH \
    PYTHONPATH=/home/app/.local/lib/python3.12/site-packages \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
USER app
EXPOSE 4003
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-4003}"]
