"""Logging estructurado en JSON con trace_id (Practica 10), equivalente
Python de P5/services/gateway/src/observability/logger.ts. Se usa el
modulo `logging` estandar con un Formatter propio en vez de agregar una
dependencia nueva (python-json-logger): el formato que pide el enunciado
(JSON + trace_id) es simple de lograr con lo que ya trae Python.
"""

import json
import logging
import sys
from datetime import datetime, timezone

from opentelemetry import trace


class JsonTraceFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        span = trace.get_current_span()
        trace_id = None
        ctx = span.get_span_context()
        if ctx and ctx.is_valid:
            trace_id = format(ctx.trace_id, "032x")

        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "service": record.name,
            "message": record.getMessage(),
            "trace_id": trace_id,
        }
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry)


def setup_logging(service_name: str) -> logging.Logger:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonTraceFormatter())

    logger = logging.getLogger(service_name)
    logger.setLevel(logging.INFO)
    logger.handlers = [handler]
    logger.propagate = False
    return logger
