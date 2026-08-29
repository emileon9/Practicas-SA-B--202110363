"""
Consumidor del flujo asincrono (seccion D + H del enunciado de la
Practica 5). Corre en un hilo de fondo, separado del loop de asyncio de
FastAPI: se conecta a RabbitMQ con pika (API bloqueante), consume la cola
durable donde el CronJob 2 publica el resumen de ejecuciones, y solo hace
`ack` del mensaje despues de haberlo insertado con exito en PostgreSQL. Si
el consumidor esta caido, RabbitMQ acumula los mensajes en la cola durable
sin perder informacion; al reconectar, los procesa todos.
"""
import json
import logging
import os
import threading
import time

import pika
import psycopg2

logger = logging.getLogger("ms-notifications.summary_consumer")

_stop_event = threading.Event()
_thread: threading.Thread | None = None


def _env(name: str, default: str | None = None) -> str | None:
    return os.environ.get(name, default)


def _ensure_table(conn) -> None:
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS cronjob_summary (
                    id SERIAL PRIMARY KEY,
                    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    summary_payload JSONB NOT NULL
                )
                """
            )


def _store_summary(db_conn, payload: dict) -> None:
    with db_conn:
        with db_conn.cursor() as cur:
            cur.execute(
                "INSERT INTO cronjob_summary (summary_payload) VALUES (%s)",
                (json.dumps(payload),),
            )


def _run() -> None:
    broker_host = _env("BROKER_HOST")
    if not broker_host:
        logger.warning(
            "BROKER_HOST no configurado; el consumidor de resumenes no arranca "
            "(esto es normal fuera de Kubernetes, por ejemplo en npm/uvicorn "
            "local sin RabbitMQ)."
        )
        return

    broker_port = int(_env("BROKER_PORT", "5672"))
    broker_user = _env("BROKER_USER", "guest")
    broker_password = _env("BROKER_PASSWORD", "guest")
    queue_name = _env("BROKER_SUMMARY_QUEUE", "cronjob.summary.q")

    db_host = _env("DB_HOST")
    db_port = _env("DB_PORT", "5432")
    db_name = _env("DB_NAME")
    db_user = _env("DB_USER")
    db_password = _env("DB_PASSWORD")

    db_conn = psycopg2.connect(
        host=db_host, port=db_port, dbname=db_name,
        user=db_user, password=db_password, connect_timeout=10,
    )
    _ensure_table(db_conn)

    def on_message(channel, method, properties, body):
        try:
            payload = json.loads(body)
            _store_summary(db_conn, payload)
            channel.basic_ack(delivery_tag=method.delivery_tag)
            logger.info("cronjob_summary: mensaje procesado y confirmado (%s)", payload)
        except Exception:
            logger.exception("Fallo procesando el resumen; se reencola el mensaje")
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

    credentials = pika.PlainCredentials(broker_user, broker_password)
    parameters = pika.ConnectionParameters(
        host=broker_host, port=broker_port, credentials=credentials,
        heartbeat=30, blocked_connection_timeout=30,
    )

    while not _stop_event.is_set():
        try:
            connection = pika.BlockingConnection(parameters)
            channel = connection.channel()
            channel.queue_declare(queue=queue_name, durable=True)
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=queue_name, on_message_callback=on_message)
            logger.info("Consumidor escuchando en la cola '%s'", queue_name)
            while not _stop_event.is_set():
                connection.process_data_events(time_limit=1)
            channel.close()
            connection.close()
        except Exception:
            logger.exception("Conexion a RabbitMQ perdida; reintentando en 5s")
            time.sleep(5)


def start() -> None:
    global _thread
    if _thread is not None:
        return
    _thread = threading.Thread(target=_run, name="summary-consumer", daemon=True)
    _thread.start()


def stop() -> None:
    _stop_event.set()
