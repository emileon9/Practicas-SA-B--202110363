# Informe de la prueba de DR — sa-platform (Práctica 9)

> Plantilla exacta exigida por el enunciado (sección 4.2). Los valores
> marcados `PENDIENTE` / `PENDIENTE DE PRUEBA` se completarán con datos
> reales después de ejecutar `P9/bootstrap/bootstrap.sh` y los scripts de
> `P9/scripts/` — nunca se inventan tiempos ni resultados antes de
> medirlos (valor formativo de la práctica: "Honestidad técnica").

## 1. Objetivos declarados

- **RTO objetivo:** PENDIENTE
- **RPO objetivo:** PENDIENTE
- **Justificación:** PENDIENTE — se completará antes de ejecutar la
  prueba real, considerando: tiempo de instalación de ArgoCD vía Helm,
  tiempo de sync del app-of-apps completo (10 Applications), y la
  frecuencia del `Schedule` de Velero (diario, `0 5 * * *`, ver
  `P9/velero/gitops/schedule.yaml`) como cota inferior razonable del RPO
  objetivo.

## 2. Escenario ejecutado

PENDIENTE — se documentará exactamente qué se destruyó y en qué orden
(por ejemplo: namespace `sa-p5` completo, o clúster completo incluyendo
`argocd`) la primera vez que se ejecute la prueba real.

## 3. Tiempos medidos

- **RTO real:** PENDIENTE DE PRUEBA
- **Marcas de tiempo que lo respaldan:** ver
  `P9/evidence/reconstruccion-<fecha>.log`, generado por
  `P9/bootstrap/bootstrap.sh` (PENDIENTE: archivo no existe todavía).

## 4. Pérdida medida

- **RPO real:** PENDIENTE DE PRUEBA
- **Qué datos no se recuperaron y por qué:** PENDIENTE — se completará
  comparando la marca de prueba sembrada antes del backup
  (`P9/scripts/db-seed-test-data.sh`) contra el contenido restaurado
  (`P9/scripts/velero-restore.sh`).

## 5. Puntos únicos de fallo detectados

PENDIENTE de la ejecución real. Candidatos ya identificados por
inspección del sistema (a confirmar o descartar con la prueba):

- La llave de Sealed Secrets es un punto único de fallo por diseño: si se
  pierde sin respaldo, **ningún** secreto del sistema es recuperable,
  sin importar qué tan bien funcionen Velero o Terraform.
- RabbitMQ (`P8/platform/rabbitmq.yaml`) y el propio PostgreSQL
  (`P9/kubernetes/database/postgres.yaml`) son `replicas: 1` — sin
  redundancia a nivel de la propia base de datos/broker, la
  recuperación depende enteramente de Velero, no de alta disponibilidad.
- El backend remoto de Terraform (PENDIENTE de bucket real) es en sí
  mismo un punto único de fallo para poder *reconstruir infraestructura
  nueva* (no para el sistema en ejecución): si el bucket se pierde, el
  estado de Terraform se pierde, aunque el clúster siga vivo.

## 6. Brecha y plan

PENDIENTE — se completará contrastando la sección 1 contra las secciones
3 y 4 después de la ejecución real. Plan de cierre de brecha: PENDIENTE.

---

*Última actualización de este informe: preparado antes de la ejecución
real, como parte de la entrega inicial versionada de la Práctica 9. Ver
`P9/README.md` para el estado completo de lo implementado vs. lo
pendiente de probar.*
