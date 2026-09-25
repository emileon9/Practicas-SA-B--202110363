#!/usr/bin/env bash
# Envoltorio para correr el script de verificacion del auxiliar
# (Fix_Script_p8.sh) con todas las herramientas en el PATH.
#
# winget instalo terraform, trivy y jq en carpetas que no quedan en el PATH
# de la terminal; cosign, kubectl-argo-rollouts y argocd se descargaron como
# binarios sueltos. Este script los agrega solo para esta ejecucion.
#
# Uso desde Git Bash:      bash verificar.sh
# Uso desde PowerShell:    & "C:\Program Files\Git\bin\bash.exe" verificar.sh
#
# Requiere Docker Desktop encendido con Kubernetes: la mitad de las
# verificaciones consultan el cluster (ArgoCD, Rollout, Kyverno).
set -uo pipefail

cd "$(dirname "$0")"

WINGET_ROOT="/c/Users/Emily/AppData/Local/Microsoft/WinGet/Packages"
LOCAL_ROOT="/c/Users/Emily/AppData/Local"

add_dir() { [ -d "$1" ] && PATH="$PATH:$1"; }

# Herramientas instaladas con winget (la carpeta lleva un sufijo que puede
# cambiar entre versiones, por eso se resuelve buscando el ejecutable).
for exe in terraform.exe trivy.exe jq.exe; do
  found=$(find "$WINGET_ROOT" -iname "$exe" 2>/dev/null | head -1)
  [ -n "$found" ] && add_dir "$(dirname "$found")"
done

# Binarios descargados sueltos.
add_dir "$LOCAL_ROOT/cosign"
add_dir "$LOCAL_ROOT/argo-rollouts"
add_dir "$LOCAL_ROOT/argocd-cli"

export PATH

faltan=""
for t in git jq kubectl helm terraform trivy cosign argocd; do
  command -v "$t" >/dev/null 2>&1 || faltan="$faltan $t"
done
kubectl argo rollouts version >/dev/null 2>&1 || faltan="$faltan kubectl-argo-rollouts"

if [ -n "$faltan" ]; then
  echo "AVISO: no se encontraron estas herramientas:$faltan"
  echo "       Sus verificaciones saldran en cero."
  echo
fi

exec bash Fix_Script_p8.sh
