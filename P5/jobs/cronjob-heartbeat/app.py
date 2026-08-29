"""
CronJob 1 (Practica 5, seccion H): se ejecuta cada 2 minutos e inserta en
PostgreSQL un registro con la fecha/hora de ejecucion en zona horaria GMT-6
y el numero de carne del estudiante.

El carne y la zona horaria NO estan hardcodeados: llegan como variables de
entorno (STUDENT_CARNE, TZ) inyectadas por Helm desde el ConfigMap
sa-platform-config (ver charts/sa-platform/templates/configmap.yaml).
Corre una sola vez y termina (exit 0), como corresponde a un Job de
Kubernetes.
"""
import os
import sys
from datetime import datetime, timezone, timedelta

import psycopg2

GMT_MINUS_6 = timezone(timedelta(hours=-6))


def get_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(f"ERROR: falta la variable de entorno {name}", file=sys.stderr)
        sys.exit(1)
    return value


def main() -> None:
    db_host = get_env("DB_HOST")
    db_port = os.environ.get("DB_PORT", "5432")
    db_name = get_env("DB_NAME")
    db_user = get_env("DB_USER")
    db_password = get_env("DB_PASSWORD")
    student_carne = get_env("STUDENT_CARNE")

    executed_at = datetime.now(GMT_MINUS_6)

    conn = psycopg2.connect(
        host=db_host, port=db_port, dbname=db_name,
        user=db_user, password=db_password, connect_timeout=10,
    )
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS execution_log (
                        id SERIAL PRIMARY KEY,
                        executed_at TIMESTAMPTZ NOT NULL,
                        student_carne VARCHAR(20) NOT NULL
                    )
                    """
                )
                cur.execute(
                    "INSERT INTO execution_log (executed_at, student_carne) "
                    "VALUES (%s, %s)",
                    (executed_at, student_carne),
                )
        print(
            f"execution_log: insertado {executed_at.isoformat()} "
            f"(carne={student_carne})"
        )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
