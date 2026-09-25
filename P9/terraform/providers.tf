terraform {
  required_version = ">= 1.5.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.14"
    }
  }

  # --- Estado remoto (Práctica 9, criterio "Estado remoto y disciplina de
  #     IaC") ---
  #
  # P8/terraform corre con estado LOCAL (terraform.tfstate en el disco del
  # estudiante) porque en P8 el requisito no existía. La práctica 9 exige
  # explícitamente que NINGÚN archivo de estado viva en el repositorio y
  # que el backend remoto tenga bloqueo. Se elige el backend "gcs" (Google
  # Cloud Storage) porque el ecosistema ya usa Google Cloud desde la
  # Práctica 6 (GKE) — no se introduce un proveedor nuevo solo para esto.
  #
  # PENDIENTE: crear el bucket real y descomentar este bloque. Mientras
  # tanto, Terraform seguiría usando estado local, lo cual NO cumple el
  # criterio 2.2 de la rúbrica — no ejecutar `terraform apply` en este
  # estado hasta que el backend esté configurado.
  #
  # backend "gcs" {
  #   bucket = "PENDIENTE-nombre-del-bucket"   # ver backend.hcl.example
  #   prefix = "sa-platform/p9/terraform/state"
  # }
  #
  # El bucket de GCS provee bloqueo de estado nativo (no se necesita una
  # tabla de lock aparte, a diferencia del backend "s3"). Inicializar con:
  #
  #   terraform init -backend-config=backend.hcl
  #
  # nunca con los valores del backend escritos directamente en este
  # archivo (así se evita tener que versionar el nombre real del bucket
  # como parte del código, aunque no sea secreto, y permite usar buckets
  # distintos en dev/CI sin tocar el .tf).
}

# Mismo patrón que P8/terraform/providers.tf: usa el kubeconfig local del
# estudiante. Terraform corre localmente contra el clúster local
# (docker-desktop / minikube), nunca se pide un kubeconfig como secret de
# CI.
provider "kubernetes" {
  config_path    = var.kubeconfig_path
  config_context = var.kube_context
}

provider "helm" {
  kubernetes {
    config_path    = var.kubeconfig_path
    config_context = var.kube_context
  }
}
