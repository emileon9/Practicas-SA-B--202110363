# Arquitectura GitOps objetivo — Práctica 8

Este documento describe el flujo objetivo (a implementar en las Fases 2-5) y
el rol exacto de cada componente. No documenta nada que ya esté corriendo
hoy: hoy únicamente existe el pipeline de P7 descrito en
[../README.md](../README.md).

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

GITOPS / MANIFEST REPOSITORY (repositorio independiente, por crear)
   Practicas-SA-B--202110363-gitops   (nombre sugerido, a confirmar
                                        manualmente por el estudiante)
   - valores de imagen/tag por ambiente (dev/prod)
   - manifiesto(s) de Argo Rollouts (Rollout + AnalysisTemplate)
   - Application(s) de ArgoCD
   - única fuente de verdad de "qué versión corre en qué ambiente"
```

El repositorio GitOps **no se puede crear de forma remota desde aquí**
(requiere una acción manual del estudiante en GitHub). Ver la sección 5 para
la lista exacta de pasos manuales.

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

## 4. Decisión: chart único (`sa-platform`) vs. un chart por servicio

La Práctica 8 pide "un chart por microservicio". El repositorio ya tiene un
único chart umbrella (`P5/charts/sa-platform`) donde cada uno de los 7
componentes es un subchart local completamente parametrizado (imagen,
réplicas, recursos, probes, HPA) con overlays `values-dev.yaml` /
`values-prod.yaml`.

Fragmentar esto en 7 `Chart.yaml` independientes duplicaría templates
idénticos (Deployment, Service, HPA) sin ganancia real, y contradice la
instrucción de no duplicar manifiestos innecesariamente. La decisión tomada
para P8 es **mantener el chart umbrella** y tratar cada subchart
(`gateway`, `ms-users`, `ms-products`, `ms-orders`, `ms-notifications`) como
el equivalente funcional de "un chart por microservicio": cada uno tiene su
propio `values.yaml` de subchart, su propio `image.repository`/`image.tag`,
y puede versionarse/desplegarse de forma independiente vía
`--set <servicio>.image.tag=vX.Y.Z`.

Esto se ampliará con el detalle real de `values-dev.yaml`/`values-prod.yaml`
para P8 en la Fase 2.

## 5. Qué debe crear manualmente el estudiante en GitHub

Ninguno de estos pasos se puede automatizar desde este entorno (requieren
una cuenta de GitHub autenticada interactivamente):

1. Crear un repositorio nuevo, vacío, independiente del actual (por ejemplo
   `Practicas-SA-B--202110363-gitops`).
2. Clonarlo localmente y copiar dentro la estructura que se deje preparada
   en `P8/argocd/` y `P8/helm-gitops-values/` (o el nombre que se defina en
   Fase 3) una vez existan.
3. Crear un Personal Access Token (o GitHub App) con permiso de escritura
   **solo sobre ese repositorio GitOps**, y agregarlo como secret en el
   repositorio de código (por ejemplo `GITOPS_REPO_TOKEN`) para que el
   workflow de actualización de versión pueda abrir el Pull Request.
4. Instalar ArgoCD en el clúster que se vaya a usar para la demo y crear ahí
   la `Application` que apunte al repositorio GitOps recién creado.

No se inventa aquí ningún nombre definitivo de repositorio, token o URL:
estos se completarán en el README principal (tabla de evidencias) una vez
existan realmente.
