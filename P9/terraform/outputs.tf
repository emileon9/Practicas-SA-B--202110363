output "argocd_namespace" {
  description = "Namespace donde quedó instalado ArgoCD."
  value       = kubernetes_namespace.argocd.metadata[0].name
}

output "root_application_name" {
  description = "Nombre de la Application raíz (app-of-apps) que reconstruye el resto del sistema."
  value       = "sa-platform-root"
}

output "argocd_port_forward_command" {
  description = "Comando para acceder a la UI de ArgoCD sin exponerla públicamente."
  value       = "kubectl port-forward svc/argocd-server -n ${var.argocd_namespace} 8080:443"
}
