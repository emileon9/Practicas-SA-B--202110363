"""Inicializacion de OpenTelemetry (Practica 10) para ms-orders.

A diferencia de gateway/ms-users (Node, donde el SDK se inicializa con un
import de efecto secundario antes que el resto de la app), en Python el
patron equivalente es llamar `setup_tracing(app)` explicitamente dentro
de app/main.py, DESPUES de crear la instancia de FastAPI pero antes de
que reciba trafico real -- `FastAPIInstrumentor.instrument_app` necesita
la instancia de la app para envolver su manejo de requests.

Tambien instrumenta httpx: es el cliente que usa
app/services/users_client.py para llamar a ms-users, asi que sin esto el
traceparent no se propagaria automaticamente en esa llamada saliente y
la traza se cortaria en ms-orders en vez de seguir hasta ms-users.
"""

import os

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, SERVICE_VERSION, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

_OTLP_ENDPOINT = os.getenv(
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "http://otel-collector.observability.svc.cluster.local:4318",
)


def setup_tracing(app) -> None:
    # OTEL_SDK_DISABLED es la variable estandar de OpenTelemetry (no una
    # convencion propia). tests/test_orders.py la activa antes de importar
    # app.main: sin esto, cada corrida de pytest crearia de verdad un
    # OTLPSpanExporter intentando conectar al Collector, con hilos de
    # background innecesarios en un proceso de tests que no tiene (ni
    # deberia tener) un clúster detras.
    if os.getenv("OTEL_SDK_DISABLED", "false").lower() == "true":
        return

    resource = Resource.create(
        {
            SERVICE_NAME: os.getenv("OTEL_SERVICE_NAME", "ms-orders"),
            SERVICE_VERSION: os.getenv("IMAGE_TAG", "unknown"),
        }
    )
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=f"{_OTLP_ENDPOINT}/v1/traces")
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(app)
    HTTPXClientInstrumentor().instrument()
