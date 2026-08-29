# Evidencias

Plantilla para pegar las salidas reales de cada prueba, tal como exige el
enunciado. **No se completa ningún bloque hasta ejecutar el comando
correspondiente contra el clúster real** — no se inventan evidencias.

## 1. Ciclo de vida con Helm (install, upgrade, rollback)

```
$ helm install sa-platform . -n sa-p5 -f values-dev.yaml -f values-secrets.yaml
<pegar salida real>

$ helm upgrade sa-platform . -n sa-p5 -f values-dev.yaml -f values-secrets.yaml
<pegar salida real>

$ helm history sa-platform -n sa-p5
<pegar salida real: debe mostrar al menos revision 1 (install) y 2 (upgrade)>

$ helm rollback sa-platform 1 -n sa-p5
<pegar salida real>

$ helm history sa-platform -n sa-p5
<pegar salida real: debe mostrar la revision 3 como rollback a 1>
```

## 2. Persistencia (datos sobreviven al borrado del pod de PostgreSQL)

Ver procedimiento completo en [persistence.md](persistence.md).

```
<pegar SELECT antes del borrado>
<pegar kubectl delete pod sa-postgresql-0>
<pegar kubectl rollout status statefulset/sa-postgresql>
<pegar SELECT despues del borrado — deben ser las mismas filas>
```

## 3. Bloqueo por NetworkPolicy (pod no autorizado)

Ver procedimiento completo en [networking.md](networking.md).

```
<pegar los 3 wget fallidos desde el pod "intruder">
<pegar el wget exitoso (o sin timeout) desde ms-notifications hacia postgresql>
```

## 4. Comunicación asíncrona (consumidor caído, mensajes acumulados, sin pérdida)

Ver procedimiento completo en [async-messaging.md](async-messaging.md).

```
<pegar rabbitmqctl list_queues con mensajes acumulados (consumidor en 0 replicas)>
<pegar rabbitmqctl list_queues en 0 tras restaurar el consumidor>
<pegar SELECT * FROM cronjob_summary con las filas resultantes>
```

## 5. Escalado por HPA bajo carga

Ver procedimiento completo en [load-testing.md](load-testing.md).

```
<pegar el log de `kubectl get hpa -n sa-p5 -w` mostrando el aumento y luego
 la baja de REPLICAS>
<pegar el resumen final de k6 (RPS, p95, % error)>
```

## 6. Actualización sin downtime (RollingUpdate maxUnavailable: 0)

Procedimiento: mientras corre `helm upgrade` con un cambio de imagen/tag,
lanzar en paralelo un loop de peticiones continuas contra el gateway y
confirmar que ninguna falla:

```bash
while true; do
  curl -s -o /dev/null -w "%{http_code}\n" http://sa-platform.local/health
  sleep 0.5
done
```

```
<pegar la salida del loop durante el upgrade: debe ser 200 en cada linea,
 sin ningun codigo de error ni conexion rechazada>
<pegar `kubectl rollout status deployment/gateway -n sa-p5`>
```

## 7. Cronjobs encadenados

```
$ kubectl get cronjobs -n sa-p5
<pegar salida>

$ kubectl get jobs -n sa-p5
<pegar salida tras esperar al menos 10-12 minutos para ver ambos cronjobs
 ejecutar automaticamente segun su schedule>

$ kubectl logs job/<nombre-del-job-mas-reciente-de-cronjob-heartbeat> -n sa-p5
<pegar salida: "execution_log: insertado ...">

$ kubectl logs job/<nombre-del-job-mas-reciente-de-cronjob-summary> -n sa-p5
<pegar salida: "Publicado en 'cronjob.summary.q': ...">
```
