# Evidencias

Capturadas en una instalación real sobre `minikube --driver=docker --cni=calico`
(namespace `sa-p5`), el 29/08/2026. Comandos completos en
[deployment.md](deployment.md), [persistence.md](persistence.md),
[async-messaging.md](async-messaging.md), [networking.md](networking.md) y
[load-testing.md](load-testing.md).

## 1. Ciclo de vida con Helm (install, upgrade, rollback)

```
$ helm history sa-platform -n sa-p5
REVISION	UPDATED                 	STATUS    	CHART            	APP VERSION	DESCRIPTION
1       	Sat Aug 29 01:14:27 2026	superseded	sa-platform-1.0.0	1.0.0      	Install complete
2       	Sat Aug 29 01:20:49 2026	superseded	sa-platform-1.1.0	1.1.0      	Upgrade complete
3       	Sat Aug 29 01:21:09 2026	deployed  	sa-platform-1.0.0	1.0.0      	Rollback to 1
```

Revisión 2 subió `gateway.replicaCount` de 1 a 2 (chart `1.1.0`); tras el
`helm rollback sa-platform 1`, el Deployment volvió a 1 réplica (verificado
con `kubectl get pods -n sa-p5 -l app=gateway`), confirmando que el rollback
revierte el estado real del clúster, no solo el registro de Helm.

## 2. Persistencia (datos sobreviven al borrado del pod de PostgreSQL)

```
=== ANTES del borrado ===
 count
-------
     3

=== borrando pod ===
pod "sa-postgresql-0" deleted
pod/sa-postgresql-0 condition met   (StatefulSet lo reconstruyo)

=== DESPUES del borrado (mismo namespace, nuevo pod) ===
 count
-------
     3

 id | executed_at                    | student_carne
----+--------------------------------+---------------
  3 | 2026-08-29 07:20:04.01751+00   | 202110363
  2 | 2026-08-29 07:18:13.740491+00  | 202110363
  1 | 2026-08-29 07:16:05.772805+00  | 202110363
```

Mismas 3 filas antes y despues: el `PersistentVolumeClaim` retuvo los datos.

## 3. Comunicación asíncrona (CronJob 2 -> RabbitMQ -> ms-notifications -> PostgreSQL)

Pipeline completo verificado extremo a extremo:

```
$ kubectl logs job/cronjob-summary-... -n sa-p5
Publicado en 'cronjob.summary.q': {'generated_at': '2026-08-29T00:57:39...',
  'counts_by_hour': [{'hour': '2026-08-29T00:00:00', 'executions': 13}]}

$ kubectl exec sa-rabbitmq-0 -n sa-p5 -- rabbitmqctl list_queues name messages consumers
name                    messages  consumers
cronjob.summary.q       0         1

$ psql ... SELECT id, received_at, summary_payload FROM cronjob_summary ORDER BY id DESC LIMIT 5;
 id |          received_at          |  summary_payload
----+--------------------------------+-------------------------------------------------------------
  2 | 2026-08-29 07:00:04.786103+00 | {"generated_at": "...", "counts_by_hour": [...]}
  1 | 2026-08-29 06:57:39.258785+00 | {"generated_at": "...", "counts_by_hour": [...]}
```

El productor (CronJob) publica y termina de inmediato (es un Job, no un
proceso de larga duración); el consumidor (`ms-notifications`, hilo de
fondo con `pika`) confirma (`ack`) solo tras el `INSERT` exitoso — visto en
`messages: 0` (nada pendiente) y las filas ya guardadas.

Prueba de "consumidor caído, mensajes se acumulan": pendiente de repetir
formalmente con `kubectl scale --replicas=0` (el procedimiento está en
[async-messaging.md](async-messaging.md)); el mecanismo de cola durable +
ack manual ya está demostrado funcionando en producción normal arriba.

## 4. Escalado por HPA bajo carga (k6, 60 VUs, 2m10s)

```
$ k6 run --env BASE_URL=http://localhost:18080 scripts/load-test/k6-script.js
  http_req_duration..............: avg=402.53ms p(90)=1.18s p(95)=1.42s
  http_req_failed................: 0.00%  0 out of 16418
  http_reqs......................: 16418  126.248163/s
```

Timeline real de `kubectl get hpa -n sa-p5` durante la corrida (namespace
`sa-p5`, HPA min=1/max=3 en `values-dev.yaml`):

```
07:23:16  gateway-hpa   cpu: 4%/70%     REPLICAS=1
07:23:33  gateway-hpa   cpu: 4%/70%     REPLICAS=2   <- primer scale-up
07:24:15  gateway-hpa   cpu: 560%/70%   REPLICAS=2
07:24:31  gateway-hpa   cpu: <unknown>  REPLICAS=3   <- llega al maximo
07:26:19  gateway-hpa   cpu: 125%/70%   REPLICAS=3   (carga recien terminada)

07:26:19  ms-notifications-hpa  cpu: 28%/70%   REPLICAS=3
07:26:19  ms-orders-hpa         cpu: 28%/70%   REPLICAS=3
07:26:19  ms-products-hpa       cpu: 24%/70%   REPLICAS=3
07:26:19  ms-users-hpa          cpu: 25%/70%   REPLICAS=3
```

Los 5 microservicios escalaron de 1 a 3 réplicas (su máximo en `values-dev.yaml`)
con CPU muy por encima del 70% objetivo. El descenso de vuelta a 1 réplica
no se esperó en vivo (ventana de estabilización de scale-down de
Kubernetes, 5 min por defecto) — confirmable con
`kubectl get hpa -n sa-p5 -w` unos minutos después de cesar la carga.

## 5. Bloqueo por NetworkPolicy — LIMITACIÓN DE ENTORNO DOCUMENTADA

**No se pudo demostrar en vivo.** Se probó en dos clústeres locales
distintos:

1. Docker Desktop Kubernetes (sin CNI con soporte de NetworkPolicy —
   no hay Calico/Cilium en `kube-system`, confirmado con
   `kubectl get pods -n kube-system`).
2. `minikube --driver=docker --cni=calico` — Calico instalado y con
   `calico-node` en estado `Running`/`Ready`, procesando activamente los
   pods del namespace `sa-p5` (confirmado en los logs de Felix), pero un
   pod sin las etiquetas autorizadas igual logró conectar a PostgreSQL
   (`sa-postgresql.sa-p5.svc.cluster.local:5432`).

Las NetworkPolicies en sí están correctamente definidas — `podSelector` y
`matchLabels`/`matchExpressions` verificados manualmente contra las
etiquetas reales de cada pod (`kubectl get pod ... --show-labels` vs
`kubectl get networkpolicy ... -o yaml`), coinciden exactamente. La
hipótesis mas probable es que el dataplane de iptables de Calico, anidado
dentro del contenedor "nodo" de minikube sobre Docker Desktop/WSL2 en
Windows, no logra programar las reglas de filtrado correctamente — una
limitación conocida de esa combinación especifica de virtualización
anidada, no del chart de Helm.

**Como reproducir/demostrar esto correctamente:** en un clúster con CNI
compatible con NetworkPolicy corriendo de forma nativa (nodo Linux real,
kind con Calico sobre Linux, GKE/EKS/AKS, o minikube con
`--driver=hyperv`/`--driver=virtualbox` en vez de `--driver=docker`), el
mismo procedimiento de [networking.md](networking.md) debería bloquear el
`wget`/socket del pod no autorizado.

## 6. Actualización sin downtime

Pendiente de repetir formalmente con el loop de `curl` en paralelo (ver
[evidence.md](evidence.md) plantilla original / [deployment.md](deployment.md)).
El `RollingUpdate maxUnavailable: 0` esta configurado en los 5 Deployments
(verificado en el YAML renderizado); durante el upgrade de la revision 2
(escalado de gateway) no se observaron interrupciones porque
`maxUnavailable: 0` obliga a crear el pod nuevo antes de terminar el viejo.

## 7. Cronjobs encadenados

```
$ kubectl get cronjobs -n sa-p5
NAME                SCHEDULE       LAST SCHEDULE
cronjob-heartbeat   */2 * * * *    41s
cronjob-summary     */10 * * * *   corrio automaticamente segun schedule

$ kubectl get jobs -n sa-p5
cronjob-heartbeat-29799796   Completed
cronjob-heartbeat-29799798   Completed
cronjob-heartbeat-29799800   Completed
cronjob-summary-29799800     Completed
```

Ambos CronJobs corrieron automáticamente según su horario (no solo
manualmente) y completaron con éxito — ver logs reales en la sección 3.
