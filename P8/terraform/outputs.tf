output "namespace" {
  description = "Namespace administrado por este Terraform."
  value       = kubernetes_namespace.platform.metadata[0].name
}

output "resource_quota_name" {
  value = kubernetes_resource_quota.platform.metadata[0].name
}

output "limit_range_name" {
  value = kubernetes_limit_range.platform.metadata[0].name
}

output "argocd_role" {
  description = "Role de minimo privilegio otorgado a ArgoCD sobre el namespace."
  value       = kubernetes_role.argocd_deployer.metadata[0].name
}
