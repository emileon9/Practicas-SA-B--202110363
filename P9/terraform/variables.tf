variable "kubeconfig_path" {
  description = "Ruta al kubeconfig local (docker-desktop o minikube). Mismo valor que P8/terraform."
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "Contexto de kubectl a usar. Verificar con `kubectl config get-contexts`."
  type        = string
  default     = "docker-desktop"
}

variable "argocd_namespace" {
  description = "Namespace donde se instala ArgoCD. Debe coincidir con P8/terraform/variables.tf (argocd_namespace)."
  type        = string
  default     = "argocd"
}

variable "argocd_chart_version" {
  description = <<-EOT
    Versión del chart oficial argo-cd (argoproj/argo-helm). PENDIENTE:
    fijar la versión exacta verificada localmente la primera vez que se
    corra `terraform apply` contra un clúster real (ver runbook.md, paso
    "Verificar Terraform"). Se deja sin fijar un default de producción
    para no afirmar una versión que todavía no se ha validado.
  EOT
  type        = string
  default     = null
}

variable "platform_namespace" {
  description = "Namespace de la plataforma de microservicios (P8/terraform lo crea y administra)."
  type        = string
  default     = "sa-p5"
}

variable "gitops_repo_url" {
  description = "Repositorio GitOps que ArgoCD debe leer para el app-of-apps."
  type        = string
  default     = "https://github.com/emileon9/practica8-gitops.git"
}

variable "code_repo_url" {
  description = "Repositorio de código (este repositorio), fuente de los charts de Helm y de los manifiestos de ArgoCD."
  type        = string
  default     = "https://github.com/emileon9/Practicas-SA-B--202110363.git"
}

variable "code_repo_revision" {
  description = "Rama del repositorio de código que se sincroniza."
  type        = string
  default     = "master"
}
