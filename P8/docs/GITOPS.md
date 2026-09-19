# Arquitectura GitOps objetivo — Práctica 8

Este documento describe el flujo y el rol exacto de cada componente. Todo lo
que aquí se describe está implementado y fue ejecutado contra un clúster
real: ver la tabla de evidencias en [../README.md](../README.md).

## 1. Dos repositorios, dos responsabilidades

```
APPLICATION / CODE REPOSITORY (este repo)
   Practicas-SA-B--202110363
   - código de los 7 servicios (P5/services, P5/jobs)
   - Dockerfiles
   - Helm chart de aplicación (P5/charts/sa-platform)
   - Terraform de infraestructura de plataforma (P8/terraform)
   - pipeline CI (tests, helm lint, trivy, sbom, build, cosign sign)
   - NO despliega nada al clúster

GITOPS / MANIFEST REPOSITORY (repositorio independiente, ya creado)
   practica8-gitops
   https://github.com/emileon9/practica8-gitops
   - valores de imagen/tag por ambiente (dev/prod)
   - manifiesto(s) de Argo Rollouts (Rollout + AnalysisTemplate)
   - Application(s) de ArgoCD
   - única fuente de verdad de "qué versión corre en qué ambiente"
```

Ambos repositorios existen y son públicos. La sección 5 documenta los pasos
manuales que hubo que hacer en GitHub para activar el flujo.

## 2. Flujo de actualización de versión

```
Git tag (vX.Y.Z) en el repo de código
        │
        ▼
GitHub Actions (repo de código)
   tests → helm lint → trivy (bloquea si CRITICAL) → sbom → docker build
   → docker push (GHCR, tag = vX.Y.Z, nunca "latest") → cosign sign
        │
        ▼
Workflow abre un Pull Request en el repo GitOps
   (actualiza únicamente el/los value(s) de tag de imagen)
        │
        ▼
Revisión/merge del PR (manual o automático) en el repo GitOps
        │
        ▼
ArgoCD detecta el cambio (polling/webhook) y sincroniza
        │
        ▼
Argo Rollouts ejecuta el canary (ver docs de Fase 4)
```

GitHub Actions **nunca** ejecuta `kubectl apply`, `kubectl set image` ni
`helm upgrade` contra el clúster, y **no** tiene ningún `kubeconfig` como
secret. La única credencial que necesita es la del propio repo GitOps (un
token con permiso de escritura para abrir el PR), no una credencial de
clúster.

## 3. ArgoCD como único aplicador de cambios

- ArgoCD vive dentro del clúster (namespace `argocd`, instalación estándar).
- Apunta al **repositorio GitOps**, no al repositorio de código.
- Un único componente (`Application` de ArgoCD) es el que ejecuta el
  equivalente de `helm upgrade`/`kubectl apply` internamente, y solo cuando
  detecta una diferencia entre el repo GitOps y el estado real del clúster.
- Política de sincronización, nombre exacto de la `Application`, namespace y
  path se documentan en `P8/argocd/` (Fase 3) con los valores reales usados,
  no antes.

## 4. Decisión: un chart de Helm independiente por componente

La Práctica 8 pide "un chart por microservicio". El repositorio ya tenía un
único chart umbrella (`P5/charts/sa-platform`) donde cada componente era un
subchart local (imagen, réplicas, recursos, probes, HPA ya parametrizados),
más un puñado de recursos compartidos definidos solo en el chart padre:
`ConfigMap` no sensible (`sa-platform-config`), dos `Secret` generados desde
`values-secrets.yaml` (credenciales de PostgreSQL/RabbitMQ), `Ingress`,
`NetworkPolicy`, `ResourceQuota`/`LimitRange` de namespace.

**Decisión tomada (confirmada explícitamente para P8): fragmentar en 7
charts de Helm completamente independientes**, uno por componente real:

```
P8/helm/
├── gateway/              (incluye su propio Ingress)
├── ms-users/
├── ms-products/
├── ms-orders/
├── ms-notifications/     (unico que consume DB + broker)
├── cronjob-heartbeat/
└── cronjob-summary/      (consume DB + broker)
```

Cada uno tiene `Chart.yaml`, `values.yaml`, `values-dev.yaml`,
`values-prod.yaml` y sus propios templates (sin heredar `_helpers.tpl` de
ningún chart padre). Verificado con `helm lint` (base + overlay dev + overlay
prod) y `helm template` sobre los 7, sin errores.

**Qué se compartía entre componentes y cómo quedó resuelto al fragmentar**
(para no perder esa cohesión ni terminar con manifiestos duplicados):

| Recurso compartido | Antes (chart padre) | Ahora |
|---|---|---|
| `ResourceQuota` / `LimitRange` / `Namespace` | Templates del chart padre | **Terraform** (`P8/terraform`), con los mismos valores reales que ya usaba P5 — ver sección 4 de ese README |
| `ConfigMap sa-platform-config` (LOG_LEVEL, TZ, DB/BROKER host, etc.) | Template del chart padre | **Resuelto**: nuevo chart `P8/helm/platform` (ConfigMap + NetworkPolicy + SealedSecrets), con su propia Application de ArgoCD (`sa-platform-platform`, sync-wave `-1` para aplicarse antes que los 7 servicios) |
| `Secret` de PostgreSQL/RabbitMQ | Template del chart padre, generado desde `values-secrets.yaml` en texto plano local | **Resuelto con Sealed Secrets**, y viven en el repositorio GitOps (`practica8-gitops/secrets/`), no en el chart: un SealedSecret es estado desplegado, no forma de la aplicación. El `encryptedData` es real, generado con `kubeseal` contra el controller de este clúster; la Application `sa-platform-secrets` lo sincroniza en sync-wave `-2`. Ver `P8/docs/SECURITY.md` |
| `Ingress` | Template del chart padre, apuntando al Service de `gateway` | Movido dentro del propio chart `gateway` (`P8/helm/gateway/templates/ingress.yaml`) |
| `NetworkPolicy` | Template del chart padre | **Resuelto**: forma parte del chart `P8/helm/platform`, junto al ConfigMap |

Ningún nombre de servicio, puerto, usuario (`runAsUser`/`runAsGroup`) ni
valor de recursos fue inventado: son los mismos que ya usaban los subcharts
de P5 (`P5/charts/sa-platform/charts/<servicio>/values.yaml`).

