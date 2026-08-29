# Comunicacion asincrona

## Componentes

- **Broker**: RabbitMQ, dependencia Bitnami (`Chart.yaml`, version
  `16.0.14`), desplegado como StatefulSet+PVC (`sa-rabbitmq`).
- **Productor**: `cronjob-summary` (Job efimero, corre cada 10 minutos).
- **Cola**: `cronjob.summary.q`, declarada `durable=true`
  (`channel.queue_declare(queue=queue_name, durable=True)` en
  `P5/jobs/cronjob-summary/app.py`).
- **Consumidor**: `ms-notifications`, hilo de fondo iniciado en el evento
  `startup` de FastAPI (`P5/services/ms-notifications/app/services/summary_consumer.py`),
  separado del loop de asyncio del servidor HTTP.

## Por que es realmente asincrono (no un HTTP disfrazado)

1. `cronjob-summary` publica el mensaje (`channel.basic_publish(...)`) y
   **termina el proceso inmediatamente** (`sys.exit` implicito al acabar
   `main()`) — no espera ninguna respuesta del consumidor, ni siquiera sabe
   si `ms-notifications` esta corriendo en ese momento.
2. El mensaje se publica con `delivery_mode=Persistent` hacia una cola
   `durable=True`: sobrevive a un reinicio de RabbitMQ (el broker lo escribe
   en el PVC, no solo en memoria).
3. `ms-notifications` hace `channel.basic_ack(delivery_tag)` **solo despues**
   de haber insertado el resumen en PostgreSQL con exito. Si la insercion
   falla, se hace `basic_nack(..., requeue=True)`: el mensaje vuelve a la
   cola en vez de perderse.

## Evidencia: consumidor caido, mensajes acumulados, luego procesados sin perdida (obligatoria)

```bash
# 1. Apagar el consumidor (escalar ms-notifications a 0 replicas)
kubectl scale deployment/ms-notifications -n sa-p5 --replicas=0

# 2. Generar mensajes mientras el consumidor esta caido:
#    forzar 2-3 ejecuciones manuales del CronJob 2 (el productor)
kubectl create job --from=cronjob/cronjob-summary manual-summary-1 -n sa-p5
kubectl create job --from=cronjob/cronjob-summary manual-summary-2 -n sa-p5
kubectl wait --for=condition=complete job/manual-summary-1 job/manual-summary-2 -n sa-p5 --timeout=60s

# 3. Confirmar que los mensajes se acumularon en la cola (Messages > 0)
kubectl exec -n sa-p5 sa-rabbitmq-0 -- rabbitmqctl list_queues name messages

# 4. Restaurar el consumidor
kubectl scale deployment/ms-notifications -n sa-p5 --replicas=2
kubectl rollout status deployment/ms-notifications -n sa-p5

# 5. Confirmar que la cola volvio a 0 mensajes pendientes (los proceso todos)
kubectl exec -n sa-p5 sa-rabbitmq-0 -- rabbitmqctl list_queues name messages

# 6. Confirmar que los resumenes quedaron guardados en PostgreSQL
#    (deben ser al menos los 2 publicados en el paso 2, sin perdida)
kubectl exec -n sa-p5 sa-postgresql-0 -- \
  env PGPASSWORD=$(kubectl get secret sa-postgresql -n sa-p5 -o jsonpath='{.data.password}' | base64 -d) \
  psql -U sa_app -d sa_platform -c "SELECT id, received_at FROM cronjob_summary ORDER BY id DESC LIMIT 5;"
```

Guardar la salida de los pasos 3 (con mensajes acumulados), 5 (cola vacia
otra vez) y 6 (filas en `cronjob_summary`) en `docs/evidence.md`.
