# Evidencia (Práctica 9)

Esta carpeta recibe la salida real de los scripts de `P9/scripts/` y
`P9/bootstrap/bootstrap.sh` — todos con marcas de tiempo (`date -u`), para
poder calcular el RTO y el RPO reales.

| Archivo esperado | Generado por |
|---|---|
| `reconstruccion-<fecha>.log` | `P9/bootstrap/bootstrap.sh` |
| `backup-<fecha>.log` | `P9/scripts/velero-backup.sh` |
| `restore-<fecha>.log` | `P9/scripts/velero-restore.sh` |
| `node-drain-<fecha>.log` | `P9/scripts/node-drain-test.sh` |
| `last-seed-marker.txt` | `P9/scripts/db-seed-test-data.sh` |
| `last-backup-name.txt` | `P9/scripts/velero-backup.sh` |

**Estado actual: PENDIENTE.** Ningún script se ha ejecutado todavía
contra un clúster real (ver `P9/README.md`, sección "Qué está pendiente
de pruebas"). Los `*.log` se excluyen de git por defecto
(`P9/.gitignore`) para no versionar intentos fallidos o de prueba; una
vez completada la ejecución real, el/los log(s) definitivos que respaldan
`P9/docs/dr-report.md` deben agregarse explícitamente con
`git add -f P9/evidence/<archivo>.log` y referenciarse por ruta exacta en
la tabla de enlaces del README principal.
