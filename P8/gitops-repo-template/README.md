# sa-platform — repositorio GitOps (plantilla)

Este directorio es la plantilla exacta que debes copiar como el
**contenido inicial** del repositorio GitOps independiente que la
Práctica 8 exige (ver
[../docs/GITOPS.md, sección 5](../docs/GITOPS.md#5-qué-debe-crear-manualmente-el-estudiante-en-github)
para los pasos manuales de creación en GitHub).

## Por qué este repo existe y qué NO contiene

Este repositorio es deliberadamente pequeño: contiene **solo** el tag de
imagen de cada componente, por ambiente. Todo lo demás (charts de Helm,
templates, recursos, probes, políticas) vive en el repositorio de código
(`P8/helm/*`), y las Applications de ArgoCD combinan ambas fuentes (ver
`P8/argocd/applications/*.yaml`, campo `sources`).

```
apps/
├── gateway/
│   ├── values-dev.yaml     { image: { tag: "" } }
│   └── values-prod.yaml
├── ms-users/
├── ms-products/
├── ms-orders/
├── ms-notifications/
├── cronjob-heartbeat/
└── cronjob-summary/
```

## Cómo se actualiza

**Nunca a mano en el flujo normal.** `.github/workflows/gitops-update.yml`
(en el repositorio de código) abre un Pull Request contra este repositorio
cada vez que se publica un tag de Git `vX.Y.Z`: build → Trivy → SBOM →
push a GHCR → cosign sign → PR aquí actualizando `apps/<servicio>/values-
prod.yaml`. Al hacer merge del PR, ArgoCD detecta el cambio y sincroniza.

## Pasos para activarlo (una sola vez, manual)

1. ✅ Repositorio creado y con contenido inicial:
   https://github.com/emileon9/practica8-gitops.
2. ✅ Secret `GITOPS_REPO_TOKEN` y variables `GITOPS_REPO_OWNER=emileon9` /
   `GITOPS_REPO_NAME=practica8-gitops` confirmados en el repositorio de
   código (no en este repo GitOps).
3. ✅ `P8/argocd/applications/*.yaml` y
   `P8/argocd/project/sa-platform-project.yaml` ya apuntan a
   `https://github.com/emileon9/practica8-gitops.git`.
4. ⬜ Instalar ArgoCD en el clúster de la demo y aplicar
   `P8/argocd/project/sa-platform-project.yaml` y las 8 Applications de
   `P8/argocd/applications/`.

**Único paso pendiente: el 4.**
