terraform {
  required_version = ">= 1.5.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
  }
}

# Usa el kubeconfig local del estudiante (docker-desktop / minikube), el
# mismo que ya usan P5/P6/P7 con kubectl y helm. Nunca se pide ni se guarda
# un kubeconfig como secret de CI: Terraform corre localmente, contra el
# clúster local, igual que "kubectl apply" corría manualmente en P5.
provider "kubernetes" {
  config_path    = var.kubeconfig_path
  config_context = var.kube_context
}
