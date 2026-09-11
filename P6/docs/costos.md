# Costos

> Los precios exactos por hora/GB **no se documentan aquí de memoria**:
> cámbian por región y con el tiempo, y el enunciado pide explícitamente no
> inventarlos. La cifra real y actualizada se verifica en:
> **GCP Console → Billing → Reports**, filtrando por el proyecto
> `sa-platform-202110363` y agrupando por servicio/SKU. (La facturación de
> GCP puede tardar algunas horas en reflejar el consumo más reciente, así
> que el número exacto del día del despliegue puede no aparecer completo de
> inmediato — lo importante para la práctica es identificar **qué recursos
> generan costo y por qué**, no un total en dólares.)

## Recursos creados que generan costo

| Recurso | Detalle real (verificado con `gcloud`) | Por qué genera costo |
|---|---|---|
| Clúster GKE Autopilot | `sa-platform-cluster`, regional, `us-central1` | Autopilot cobra una cuota de gestión del clúster **más** el cómputo (vCPU-hora / GiB-hora) que los Pods realmente solicitan — no se paga por VMs completas ociosas, a diferencia del modo Standard |
| Cómputo de los Pods | En el pico: `requests.cpu ≈ 1.5 vCPU`, `requests.memory ≈ 2.1Gi`; `limits.cpu ≈ 5.7 vCPU`, `limits.memory ≈ 4.3Gi` (namespace `sa-p5`, ver `kubectl describe resourcequota`) | Es el costo variable principal: sube con réplicas/HPA activo |
| 2 discos persistentes (PostgreSQL + RabbitMQ) | `pd-balanced`, 2Gi cada uno, zona `us-central1-c` (`gcloud compute disks list`) | Se factura por GB-mes aprovisionado, independientemente de cuánto se use |
| Load Balancer externo (Network LB, vía `ingress-nginx`) | 1 forwarding rule regional, IP `34.170.206.2` (`gcloud compute forwarding-rules list`) | GCP cobra una tarifa por hora por cada forwarding rule activa, más un cargo por GB procesado, mientras exista — **independientemente del tráfico real** |
| IP pública | Efímera, asociada al forwarding rule (no se reservó como IP estática separada — `gcloud compute addresses list` no muestra ninguna) | Una IP efímera en uso por un LB también genera costo mientras el LB exista; al eliminar el LB se libera sola |
| Artifact Registry | Repositorio `sa-platform`, **~123-129 MB** reales según el momento de la medición (`gcloud artifacts repositories describe` marcó 129.48 MB antes de publicar `ms-notifications:1.0.1`; `gcloud artifacts repositories list` marcó 123.48 MB en la verificación final de [eliminacion.md](eliminacion.md) — la diferencia es de agregación/redondeo entre ambos comandos, no un error) — de cualquier forma, mucho más pequeño que la suma de las 7 imágenes porque Artifact Registry deduplica capas base compartidas (`node:20-alpine`, `python:3.12-slim`) | Se cobra por almacenamiento (GB-mes); a este tamaño normalmente cae dentro de la capa gratuita de Artifact Registry |
| Cloud Logging / Monitoring | Habilitado por defecto en GKE (logs y métricas de los Pods) | Tiene una asignación gratuita mensual por proyecto; con el volumen de esta práctica (pocas horas, pocos pods) es improbable superarla |

## Cómo verificar el gasto real

1. **Reporte de facturación**: `console.cloud.google.com/billing` → selecciona
   la cuenta de facturación vinculada → **Reports** → filtra por proyecto
   `sa-platform-202110363`.
2. **Créditos/saldo disponible**: en la misma sección de Billing, la vista
   "Overview" muestra el crédito restante de la prueba gratuita/créditos de
   estudiante aplicados a esta cuenta.
3. Si necesitas una **estimación previa** (por ejemplo antes de escalar
   algo), usa la [calculadora de precios de GCP](https://cloud.google.com/products/calculator)
   con las especificaciones reales de la tabla de arriba — nunca cifras de
   memoria.

## Cómo se minimizaron los costos en este despliegue

- **Autopilot en vez de Standard**: se paga por lo que los Pods realmente
  piden, no por 2-3 VMs completas reservadas 24/7 estén o no ocupadas.
- **`values-prod.yaml`** ya usa réplicas modestas (2-3 por servicio, no más)
  y límites de CPU/memoria ajustados, en vez de sobre-aprovisionar.
- **PVCs pequeños** (2Gi cada uno) — suficientes para la duración de la
  práctica, no discos de producción reales.
- **Sin IP estática reservada**: se usó la IP efímera que Google asigna al
  LoadBalancer, evitando el cargo adicional por una IP estática reservada
  y no utilizada.
- **Eliminación del clúster al finalizar** (ver [eliminacion.md](eliminacion.md)):
  el ahorro más importante, porque el cómputo y el Load Balancer son los
  ítems que facturan por hora mientras existan, tengan o no tráfico.

## Recomendaciones adicionales para reducir costo (si se repitiera el ejercicio)

- Reducir aún más réplicas (usar `values-dev.yaml`, 1 réplica por servicio)
  si el objetivo es solo demostrar funcionamiento, no simular producción.
- Apagar (`helm uninstall` + eliminar el LoadBalancer) entre sesiones de
  trabajo si la práctica se hace en varios días, y volver a desplegar con
  `helm install` cuando se retome (las imágenes ya están en el registro, el
  redespliegue es rápido).
- Revisar periódicamente `console.cloud.google.com/billing/budgets` y
  configurar una alerta de presupuesto (ej. $5 USD) para detectar consumo
  inesperado temprano.
