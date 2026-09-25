# Continuidad de los secretos (Práctica 9)

## Mecanismo elegido

**Sealed Secrets**, el mismo que P8 ya usa (ver
[P8/docs/SECURITY.md, sección 5](../../../P8/docs/SECURITY.md)) — no se
migra a External Secrets, siguiendo la misma decisión ya documentada en
P8: External Secrets exigiría un backend externo (Vault / AWS Secrets
Manager / GCP Secret Manager) que el clúster local no tiene justificado.

## El problema real que describe el enunciado de la Práctica 9

> "Los secretos están cifrados en el repositorio, pero la llave que los
> descifra vive únicamente dentro del clúster: si el clúster se pierde,
> el repositorio queda lleno de contenido ilegible."

El controller de Sealed Secrets genera, la primera vez que arranca, un
par de llaves (pública/privada) dentro del clúster como un `Secret` de
Kubernetes (`kubernetes.io/tls`, namespace `kube-system`, con la
etiqueta `sealedsecrets.bitnami.com/sealed-secrets-key`). Si el clúster
se destruye sin haber respaldado esa llave, el controller que se
reinstale generará una llave **distinta**, y todos los `SealedSecret` ya
versionados en `practica8-gitops/secrets/` quedarán permanentemente
indescifrables.

## Procedimiento de respaldo (preparado, no ejecutado)

Ver [P9/scripts/sealed-secrets-key-backup.sh](../../scripts/sealed-secrets-key-backup.sh):

1. Exporta el `Secret` de la llave activa del controller a un archivo
   local fuera del clúster.
2. **Ese archivo NUNCA se versiona en git** (ver `.gitignore` en la raíz
   de `/P9`) — es la llave privada real; debe guardarse en el mismo
   almacenamiento externo que los backups de Velero, o en un gestor de
   secretos separado.

## Procedimiento de restauración (preparado, no ejecutado)

Ver [P9/scripts/sealed-secrets-key-restore.sh](../../scripts/sealed-secrets-key-restore.sh):

1. Tras reconstruir el clúster (bootstrap de Terraform + ArgoCD), y
   **antes** de que ArgoCD sincronice `sa-platform-secrets` (sync-wave
   `-2`, la primera Application en aplicarse), se restaura el `Secret` de
   la llave respaldada en `kube-system`.
2. Se reinicia el controller de Sealed Secrets para que cargue la llave
   restaurada en vez de generar una nueva.
3. Solo entonces los `SealedSecret` existentes en el repositorio GitOps
   vuelven a ser descifrables.

## Verificación de que la restauración funcionó

```bash
kubectl get secret sa-platform-db-credentials -n sa-p5 -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

Si el comando devuelve la contraseña real (no un error de descifrado ni
un secreto vacío), la continuidad de secretos quedó demostrada.

## Estado real

PENDIENTE — no se ha ejecutado todavía contra un clúster real. Ver
[P9/README.md](../../README.md), sección "Qué está pendiente de
pruebas".
