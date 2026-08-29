# Pruebas de carga y escalado (HPA)

## HPA configurado

Cada uno de los 5 microservicios tiene un `HorizontalPodAutoscaler`
(`autoscaling/v2`) con:

```yaml
minReplicas: 2
maxReplicas: 5
targetCPUUtilizationPercentage: 70
```

Requiere `metrics-server` habilitado en el cluster (Docker Desktop
Kubernetes lo trae deshabilitado por defecto):

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
# Docker Desktop usa certificados self-signed internos; sin este patch
# metrics-server queda en CrashLoopBackOff:
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
kubectl get apiservice v1beta1.metrics.k8s.io
kubectl top pods -n sa-p5   # debe mostrar CPU/memoria reales, no error
```

## Script de carga

`P5/scripts/load-test/k6-script.js` golpea el Gateway (`/health` y las 4
rutas `/api/*/health` + `/api/orders/orders` + `/api/notifications/notifications`)
con una rampa de VUs: `0 -> 20 (1m) -> 80 (2m) -> sostenido 80 (3m) -> 0 (1m)`.

```bash
"/c/Program Files/k6/k6.exe" run --env BASE_URL=http://sa-platform.local \
  P5/scripts/load-test/k6-script.js
```

## Como capturar la evidencia de escalado (obligatoria)

En 3 terminales simultaneas, justo antes de lanzar k6:

```bash
# Terminal 1
kubectl get hpa -n sa-p5 -w

# Terminal 2
kubectl get pods -n sa-p5 -l app=gateway -w

# Terminal 3
k6 run --env BASE_URL=http://sa-platform.local P5/scripts/load-test/k6-script.js
```

Se espera ver, en la Terminal 1, la columna `TARGETS` subir por encima de
`70%` y `REPLICAS` crecer de 2 a un valor mayor durante los minutos 2-5 de
la corrida; y al terminar k6 (minuto ~7), `REPLICAS` debe volver a bajar
hacia 2 unos minutos despues (el HPA tiene un periodo de estabilizacion de
scale-down de 5 minutos por defecto).

Guardar en `docs/evidence.md`:
- El log completo de `kubectl get hpa -n sa-p5 -w` (con timestamps).
- El resumen final que imprime k6 (`handleSummary`): RPS, latencia p95 y %
  de error — tambien queda guardado en
  `P5/scripts/load-test/results/summary.json` (no versionado).
