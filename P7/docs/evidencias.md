# Evidencias para la entrega — Práctica 7

Capturas a tomar **después** de hacer push a `master` con el runner
self-hosted registrado y corriendo. Ninguna de estas capturas existe
todavía — este documento solo indica qué tomar y dónde.

## 1. GitHub Actions — CI

1. **Workflow "CI" exitoso** — pestaña *Actions* del repositorio, vista de
   resumen del run con todos los jobs en verde.
2. **Etapa Build exitosa** — abrir el job `test-node` (cualquiera de las 3
   entradas del matrix: `gateway`, `ms-users`, `ms-products`) y capturar el
   paso "Build (tsc)" en verde.
3. **Etapa Test exitosa** — mismo job, paso "Tests (jest)" mostrando los
   `PASS` de Jest; y el job `test-python` mostrando los `passed` de pytest.
4. **Docker Build exitoso** — job `docker-validate`, capturar al menos 2 de
   las 7 entradas del matrix (una Node, una Python) en verde.

## 2. GitHub Actions — Docker Push

5. **Docker Push exitoso** — job `docker-build-push` (solo aparece en un
   push a `master`), capturar el paso "Build + push con tag de commit y
   latest" mostrando el digest publicado.

## 3. GHCR — Registro de contenedores

6. **Imágenes visibles en el registry** — ir a
   `https://github.com/emileon9?tab=packages` (o la pestaña *Packages* del
   repo) y capturar la lista de los 7 paquetes
   (`sa-platform/gateway`, `sa-platform/ms-users`, `sa-platform/ms-products`,
   `sa-platform/ms-orders`, `sa-platform/ms-notifications`,
   `sa-platform/cronjob-heartbeat`, `sa-platform/cronjob-summary`) con al
   menos dos tags visibles cada una (el SHA del commit y `latest`).

## 4. GitHub Actions — CD

7. **Workflow "CD" exitoso** — pestaña *Actions*, run de `CD` disparado por
   `workflow_run`, mostrando que corrió en el runner self-hosted (la
   etiqueta del runner aparece junto al nombre del job).
8. **helm upgrade exitoso** — paso "helm upgrade --install", capturar la
   salida con `STATUS: deployed`.
9. **Rollout verificado** — paso "Verificar rollout de cada Deployment",
   con las 5 líneas `deployment "<nombre>" successfully rolled out`.

## 5. Kubernetes — estado del clúster

10. **Pods corriendo** — salida de `kubectl get pods -n sa-p5 -o wide`
    (capturada por el propio paso "Estado final de pods y cronjobs", o
    ejecutada manualmente) mostrando todos los pods `Running` con el tag de
    imagen (SHA) visible via `kubectl describe pod <pod> -n sa-p5 | grep Image`.
11. **Deployments actualizados** — `kubectl get deployments -n sa-p5 -o wide`
    mostrando la columna `IMAGES` con el tag SHA recién publicado.

## 6. Documentación

12. **Diagrama del pipeline** — captura o export de
    [docs/pipeline-diagram.md](pipeline-diagram.md) renderizado (por
    ejemplo, la vista previa de Mermaid en GitHub al abrir el archivo).

## Notas

- Las evidencias 7–11 (todo lo que depende del runner self-hosted y del
  clúster local) solo pueden capturarse en la máquina donde se registró el
  runner y con el clúster de Kubernetes local encendido — ver
  [P7/README.md](../README.md#kubernetes) para el procedimiento completo.
- No se debe capturar ni commitear ningún archivo con contraseñas reales
  (`values-secrets.yaml`); las capturas de `kubectl get secrets` deben
  mostrar únicamente los *nombres* de los Secrets, nunca `-o yaml` sin
  redactar.
