# Seguridad de la cadena de suministro — Práctica 8

Para cada control se documenta: el archivo/configuración real, el comando
para probarlo, el resultado esperado, y la evidencia que debe capturarse
para la entrega. Nada de esto se ha "simulado": donde todavía no se ha
ejecutado contra un clúster real (porque no hay uno encendido, ver
[../README.md, sección 4](../README.md)), se marca explícitamente como
pendiente de ejecución, no como verificado.

## 1. Trivy — escaneo de vulnerabilidades

**Archivo:** [.github/workflows/gitops-update.yml](../../.github/workflows/gitops-update.yml),
paso "Trivy - escaneo de vulnerabilidades".

**Configuración real:**
```yaml
- uses: aquasecurity/trivy-action@0.28.0
  with:
    image-ref: <imagen>:<tag-semantico>
    severity: CRITICAL
    exit-code: "1"
    ignore-unfixed: true
```

`exit-code: "1"` es lo que efectivamente bloquea el pipeline (y por lo
tanto el Pull Request al repo GitOps, y la publicación de la imagen): si
Trivy encuentra al menos una vulnerabilidad `CRITICAL` con parche
disponible, el job falla antes de llegar al paso de `docker push`.
`ignore-unfixed: true` evita bloquear por CVEs sin parche todavía
disponible (nada que el equipo pueda accionar).

**Comando equivalente en local** (requiere `trivy` instalado; no
instalado todavía en esta máquina, ver ../README.md sección 4):
```bash
trivy image --severity CRITICAL --exit-code 1 --ignore-unfixed \
  ghcr.io/emileon9/sa-platform/gateway:v1.0.0
```

**Resultado esperado:** `exit code 0` si no hay CRITICAL con parche
disponible; `exit code 1` (pipeline en rojo, PR bloqueado) si las hay.

**Evidencia a capturar:** el job "Trivy - escaneo de vulnerabilidades" en
rojo en la pestaña Actions de un run real, más el artefacto
`trivy-report-<servicio>.txt` que el propio workflow sube
(`actions/upload-artifact`).

## 2. SBOM

**Archivo:** mismo workflow, paso "SBOM (Trivy, CycloneDX)".

**Comando:**
```yaml
- uses: aquasecurity/trivy-action@0.28.0
  with:
    image-ref: <imagen>:<tag>
    format: cyclonedx
    output: sbom-<servicio>-<tag>.cdx.json
```

**Equivalente local:**
```bash
trivy image --format cyclonedx --output sbom-gateway-v1.0.0.cdx.json \
  ghcr.io/emileon9/sa-platform/gateway:v1.0.0
```

**Resultado esperado:** un archivo JSON CycloneDX con la lista completa de
dependencias (paquetes npm/pip del lenguaje del servicio + paquetes del OS
base de la imagen).

**Evidencia a capturar:** el artefacto `sbom-<servicio>` subido por el
workflow (retention 90 días — más largo que el de Trivy porque el SBOM es
evidencia de largo plazo, no solo del momento del scan).

## 3. Cosign — firma de imágenes

**Archivo:** mismo workflow, pasos "Instalar cosign" / "Firmar la imagen".

**Modo:** *keyless* (Sigstore), no un par de llaves guardado como secret:
```yaml
permissions:
  id-token: write   # requerido para el OIDC efimero de Sigstore
steps:
  - uses: sigstore/cosign-installer@v3
  - run: cosign sign --yes "<imagen>:<tag>"
```

Se eligió keyless en vez de generar y guardar un par de llaves
(`cosign generate-key-pair`) porque evita tener que administrar y rotar un
secret adicional en GitHub Actions: la identidad de quien firma es el
propio workflow de GitHub (verificable contra el certificado efímero de
Sigstore/Fulcio), no una llave privada que podría filtrarse.

**Verificación antes de desplegar (Fase 5.1):**
```bash
cosign verify \
  --certificate-identity-regexp "https://github.com/emileon9/Practicas-SA-B--202110363/.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/emileon9/sa-platform/gateway:v1.0.0
```
- Imagen firmada por este pipeline → `Verification succeeded`.
- Imagen sin firmar, o firmada por otro workflow/identidad → cosign
  termina con `Error: no matching signatures` (exit code != 0).

**Cómo se aplica como gate antes del despliegue:** la forma más simple y
coherente con "ArgoCD es el único que aplica cambios" es un
`ImagePolicyWebhook`/admission policy que ejecute este mismo `cosign
verify` contra cada imagen antes de admitirla — en la práctica, la opción
más simple sin añadir otro componente es una `ClusterPolicy` de **Kyverno**
con su regla `verifyImages` (Kyverno soporta verificación de firmas Cosign
nativamente desde v1.8). Queda documentada como el siguiente paso natural
una vez Kyverno esté instalado en el clúster de demo (no incluida como
`ClusterPolicy` separada todavía porque requiere fijar la identidad OIDC
exacta del repo, que solo se puede confirmar con un run real).

**Evidencia a capturar:** salida de `cosign verify` contra la imagen
firmada (éxito) y contra una imagen sin firmar de prueba (rechazo).

## 4. Kyverno — políticas como código

Ver [../security/kyverno/](../security/kyverno/): `disallow-latest.yaml`,
`require-resource-limits.yaml`, `disallow-root.yaml`, más un manifiesto
`test-invalid-*.yaml` por política, deliberadamente inválido.

**Comando de instalación** (una vez haya un clúster local encendido):
```bash
helm repo add kyverno https://kyverno.github.io/kyverno/ --force-update
helm install kyverno kyverno/kyverno -n kyverno --create-namespace
kubectl apply -f P8/security/kyverno/disallow-latest.yaml
kubectl apply -f P8/security/kyverno/require-resource-limits.yaml
kubectl apply -f P8/security/kyverno/disallow-root.yaml
```

**Comando de prueba (por política):**
```bash
kubectl apply -n sa-p5 -f P8/security/kyverno/test-invalid-latest.yaml
kubectl apply -n sa-p5 -f P8/security/kyverno/test-invalid-no-limits.yaml
kubectl apply -n sa-p5 -f P8/security/kyverno/test-invalid-root.yaml
```

**Resultado esperado:** las 3 llamadas son rechazadas por el admission
webhook de Kyverno (`error: ... admission webhook "validate.kyverno.svc-fail"
denied the request`), nunca crean el Pod.

**Evidencia a capturar:** la salida de consola de cada `kubectl apply`
rechazado (o `kubectl describe -n kyverno policyreport`), pendiente de
ejecutar contra un clúster real.

## 5. Gestión de secretos

**Estado real encontrado en el repositorio** (auditoría explícita, no
asumida):

| Dónde se buscó | Qué se encontró |
|---|---|
| `P5/charts/sa-platform/values-secrets.yaml` | **No versionado** (`.gitignore` de P5 lo excluye) — correcto desde P5 |
| `P5/charts/sa-platform/values.example.yaml` | Contraseñas ficticias (`changeme-...`), solo de ejemplo — correcto |
| `.github/workflows/*.yml` | Sin ningún secret hardcodeado; usa `secrets.GITHUB_TOKEN` (efímero, generado por Actions) y, para el flujo GitOps, `secrets.GITOPS_REPO_TOKEN` (a crear manualmente, ver GITOPS.md sección 5) |
| Helm `values*.yaml` (P5 y P8) | Sin contraseñas; los `Secret` de DB/broker se generan con `required(...)`, fallan explícitamente si no se suministran | 
| Dockerfiles | Sin secretos embebidos |
| `P8/argocd/**`, `P8/helm/**` | Sin secretos en texto plano |

**Lo que sí era una debilidad real para el modelo GitOps**: el `Secret` de
Kubernetes que generaba el chart padre (`secrets-db.yaml`/
`secrets-broker.yaml`) es un objeto con la contraseña en Base64 (no
cifrado) — aceptable mientras se aplicaba con `helm upgrade` directo
(nunca se commiteaba ese YAML final a ningún repo), pero **no** es
aceptable dentro de un repositorio GitOps versionado, porque ArgoCD
necesita el manifiesto declarado en git.

**Solución aplicada:** Sealed Secrets
(`P8/helm/platform/templates/sealedsecrets.yaml`). El ciphertext
(`encryptedData`) sí puede vivir en git: solo el controller de Sealed
Secrets, corriendo en el clúster de destino con su propia llave privada
(que nunca sale del clúster), puede descifrarlo. Se eligió sobre External
Secrets (que requeriría un backend externo tipo Vault/AWS Secrets
Manager/GCP Secret Manager — infraestructura adicional injustificada para
un clúster local de una sola instancia).

**Comando para generar el SealedSecret real** (pendiente de ejecutar
contra un clúster con el controller instalado):
```bash
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets --force-update
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system

kubectl create secret generic sa-platform-db-credentials \
  --namespace sa-p5 --dry-run=client \
  --from-literal=DB_PASSWORD='<password-real-local>' -o yaml \
  | kubeseal --format yaml --controller-namespace kube-system \
  > P8/helm/platform/templates/sealedsecret-db-credentials.generated.yaml
```

Los placeholders `"PENDIENTE-regenerar-con-kubeseal-ver-docs-SECURITY.md"`
en `sealedsecrets.yaml` deben reemplazarse por el `encryptedData` real que
produce ese comando antes de la demo — nunca con la contraseña en texto
plano.

## 6. Versionamiento semántico (resumen)

Todas las imágenes publicadas por `gitops-update.yml` usan como tag el
nombre del tag de Git que disparó el workflow (`GITHUB_REF_NAME`,
validado por el patrón `v[0-9]+.[0-9]+.[0-9]+*` en el trigger `on.push.tags`).
Ningún job de este repositorio publica ni referencia el tag `latest`.
