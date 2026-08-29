"""
CronJob 2 (Practica 5, seccion H): se ejecuta cada 10 minutos, consulta los
registros generados por el CronJob 1 (tabla execution_log), calcula la
cantidad de ejecuciones por hora, y publica ese resumen como un mensaje
durable en RabbitMQ. El consumidor (ms-notifications) lo recibe y lo
almacena en la tabla cronjob_summary.

Este es tambien el flujo asincrono obligatorio de la seccion D: este
proceso (productor) publica el mensaje y termina inmediatamente; no espera
respuesta del consumidor.
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

import pika
import psycopg2
import psycopg2.extras

GMT_MINUS_6 = timezone(timedelta(hours=-6))


def get_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(f"ERROR: falta la variable de entorno {name}", file=sys.stderr)
        sys.exit(1)
    return value


def build_summary() -> dict:
    db_host = get_env("DB_HOST")
    db_port = os.environ.get("DB_PORT", "5432")
    db_name = get_env("DB_NAME")
    db_user = get_env("DB_USER")
    db_password = get_env("DB_PASSWORD")

    conn = psycopg2.connect(
        host=db_host, port=db_port, dbname=db_name,
        user=db_user, password=db_password, connect_timeout=10,
    )
    try:
        with conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
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
                    """
                    SELECT date_trunc('hour', executed_at AT TIME ZONE 'Etc/GMT+6')
                           AS hour_bucket,
                           count(*) AS executions
                    FROM execution_log
                    GROUP BY hour_bucket
                    ORDER BY hour_bucket
                    """
                )
                rows = cur.fetchall()
    finally:
        conn.close()

    return {
        "generated_at": datetime.now(GMT_MINUS_6).isoformat(),
        "counts_by_hour": [
            {"hour": row["hour_bucket"].isoformat(), "executions": row["executions"]}
            for row in rows
        ],
    }


def publish_summary(summary: dict) -> None:
    broker_host = get_env("BROKER_HOST")
    broker_port = int(os.environ.get("BROKER_PORT", "5672"))
    broker_user = get_env("BROKER_USER")
    broker_password = get_env("BROKER_PASSWORD")
    queue_name = os.environ.get("BROKER_SUMMARY_QUEUE", "cronjob.summary.q")

    credentials = pika.PlainCredentials(broker_user, broker_password)
    parameters = pika.ConnectionParameters(
        host=broker_host, port=broker_port, credentials=credentials,
        connection_attempts=5, retry_delay=3,
    )
    connection = pika.BlockingConnection(parameters)
    try:
        channel = connection.channel()
        # Cola durable: sobrevive a un reinicio de RabbitMQ y acumula
        # mensajes mientras el consumidor esta caido (ver docs/async-messaging.md).
        channel.queue_declare(queue=queue_name, durable=True)
        channel.basic_publish(
            exchange="",
            routing_key=queue_name,
            body=json.dumps(summary).encode("utf-8"),
            properties=pika.BasicProperties(
                delivery_mode=pika.DeliveryMode.Persistent,
                content_type="application/json",
            ),
        )
        print(f"Publicado en '{queue_name}': {summary}")
    finally:
        connection.close()


def main() -> None:
    summary = build_summary()
    publish_summary(summary)


if __name__ == "__main__":
    main()
