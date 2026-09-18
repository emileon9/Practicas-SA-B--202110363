variable "kubeconfig_path" {
  description = "Ruta al kubeconfig local (docker-desktop o minikube)."
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "Contexto de kubectl a usar. Verificar con `kubectl config get-contexts`."
  type        = string
  default     = "docker-desktop"
}

variable "namespace" {
  description = <<-EOT
    Namespace de la plataforma. Se mantiene "sa-p5" (el mismo namespace real
    usado desde la Practica 5) en vez de introducir uno nuevo: P8 no crea un
    sistema paralelo, evoluciona el despliegue del mismo sistema.
  EOT
  type        = string
  default     = "sa-p5"
}

# --- ResourceQuota: mismos valores reales que ya usaba
#     P5/charts/sa-platform/values.yaml (bloque resourceQuota), ahora
#     administrados por Terraform en vez de por el chart de Helm. ---
variable "quota_requests_cpu" {
  type    = string
  default = "3"
}

variable "quota_requests_memory" {
  type    = string
  default = "3Gi"
}

variable "quota_limits_cpu" {
  type    = string
  default = "6"
}

variable "quota_limits_memory" {
  type    = string
  default = "6Gi"
}

variable "quota_max_pods" {
  type    = string
  default = "60"
}

# --- LimitRange por defecto de contenedor: mismos valores reales que ya
#     usaba P5/charts/sa-platform/values.yaml (bloque limitRange). ---
variable "limit_default_request_cpu" {
  type    = string
  default = "50m"
}

variable "limit_default_request_memory" {
  type    = string
  default = "64Mi"
}

variable "limit_default_limit_cpu" {
  type    = string
  default = "250m"
}

variable "limit_default_limit_memory" {
  type    = string
  default = "256Mi"
}

# --- RBAC para ArgoCD ---
variable "argocd_namespace" {
  description = "Namespace donde vive la instalacion de ArgoCD (instalada por separado, no por este Terraform)."
  type        = string
  default     = "argocd"
}

variable "argocd_service_account_name" {
  description = "ServiceAccount del application-controller de ArgoCD, al que se le otorga permiso de administrar el namespace de la plataforma."
  type        = string
  default     = "argocd-application-controller"
}
