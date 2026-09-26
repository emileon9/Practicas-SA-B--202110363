output "argocd_namespace" {
  description = "Namespace donde corre ArgoCD (instalado por Terraform o adoptado, según manage_argocd_install)."
  value       = var.argocd_namespace
}

output "root_application_name" {
  description = "Nombre de la Application raíz (app-of-apps) que reconstruye el resto del sistema."
  value       = "sa-platform-root"
}

output "argocd_port_forward_command" {
  description = "Comando para acceder a la UI de ArgoCD sin exponerla públicamente."
  value       = "kubectl port-forward svc/argocd-server -n ${var.argocd_namespace} 8080:443"
}
