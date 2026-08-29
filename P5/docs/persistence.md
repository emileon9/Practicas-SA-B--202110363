# Persistencia de datos

## Como esta desplegada la base de datos

PostgreSQL se declara como **dependencia** del chart padre en `Chart.yaml`
(`bitnami/postgresql`, version `18.8.13`), resuelta con
`helm dependency update`. El chart de Bitnami crea, dentro del namespace
`sa-p5`:

- Un **StatefulSet** (`sa-postgresql`) — no un Deployment, precisamente
  porque la base de datos necesita identidad estable y almacenamiento
  persistente ligado a esa identidad (ver la respuesta teorica sobre
  StatefulSet en `docs/theoretical-questions.md`).
- Un **PersistentVolumeClaim** (tamano parametrizado:
  `postgresql.primary.persistence.size`, 512Mi en dev / 1Gi base / 2Gi prod).
- Un **headless Service** (`sa-postgresql-hl`) para que el StatefulSet tenga
  DNS estable por pod, ademas del Service normal `sa-postgresql` que usan
  los consumidores.

Usuario y base de datos de aplicacion (`sa_app` / `sa_platform`) se
configuran en `values.yaml` (`postgresql.auth.username`,
`postgresql.auth.database`); la contrasena viaja **solo** por
`values-secrets.yaml` (no versionado, ver `values.example.yaml`).

## Quien escribe y quien lee

- `cronjob-heartbeat` (cada 2 min) hace `INSERT` en `execution_log`
  (crea la tabla con `CREATE TABLE IF NOT EXISTS` si no existe).
- `cronjob-summary` (cada 10 min) hace `SELECT ... GROUP BY` sobre
  `execution_log` para construir el resumen que publica en RabbitMQ.
- `ms-notifications` (consumidor asincrono) hace `INSERT` en
  `cronjob_summary` cuando recibe un mensaje de la cola.

## Evidencia de que los datos sobreviven al borrado del pod (obligatoria)

```bash
# 1. Insertar datos: forzar una ejecucion manual del CronJob 1
kubectl create job --from=cronjob/cronjob-heartbeat manual-heartbeat-1 -n sa-p5
kubectl wait --for=condition=complete job/manual-heartbeat-1 -n sa-p5 --timeout=60s

# 2. Verificar que el dato quedo insertado
kubectl exec -n sa-p5 sa-postgresql-0 -- \
  env PGPASSWORD=$(kubectl get secret sa-postgresql -n sa-p5 -o jsonpath='{.data.password}' | base64 -d) \
  psql -U sa_app -d sa_platform -c "SELECT * FROM execution_log ORDER BY id DESC LIMIT 5;"

# 3. Identificar y eliminar el pod de la base de datos
kubectl get pods -n sa-p5 -l app.kubernetes.io/name=postgresql
kubectl delete pod sa-postgresql-0 -n sa-p5

# 4. Esperar a que el StatefulSet lo reconstruya
kubectl rollout status statefulset/sa-postgresql -n sa-p5
kubectl get pods -n sa-p5 -l app.kubernetes.io/name=postgresql -w

# 5. Comprobar que los datos SIGUEN existiendo (mismo comando que el paso 2)
kubectl exec -n sa-p5 sa-postgresql-0 -- \
  env PGPASSWORD=$(kubectl get secret sa-postgresql -n sa-p5 -o jsonpath='{.data.password}' | base64 -d) \
  psql -U sa_app -d sa_platform -c "SELECT * FROM execution_log ORDER BY id DESC LIMIT 5;"
```

Guardar la salida de los pasos 2 y 5 (antes/despues) en `docs/evidence.md`
como prueba de que el `PersistentVolumeClaim` retuvo los datos: el pod es
efimero, el volumen no.
