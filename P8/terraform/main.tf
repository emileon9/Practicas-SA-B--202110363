# Infraestructura de plataforma para sa-platform (Practica 8).
#
# Responsabilidad de este Terraform: namespace, cuotas de recursos del
# namespace y RBAC de acceso al namespace. NO administra los recursos de
# aplicacion (Deployments, Services, HPA, etc.) — eso lo hacen los charts de
# Helm en P8/helm/*, aplicados por ArgoCD. Esta separacion evita que dos
# herramientas distintas reclamen ser dueñas del mismo objeto de Kubernetes
# (ver P8/docs/GITOPS.md, seccion de decisiones).
#
# Antes de este cambio, el namespace/ResourceQuota/LimitRange los creaba el
# propio chart de Helm de P5 (ver P5/charts/sa-platform/templates/
# resourcequota.yaml y limitrange.yaml). Los valores de abajo son los MISMOS
# valores reales que ya estaban en produccion en P5/P6/P7, migrados a
# Terraform, no reinventados.

resource "kubernetes_namespace" "platform" {
  metadata {
    name = var.namespace
    labels = {
      "app.kubernetes.io/part-of"    = "sa-platform"
      "app.kubernetes.io/managed-by" = "terraform"
    }
  }
}

resource "kubernetes_resource_quota" "platform" {
  metadata {
    name      = "sa-platform-quota"
    namespace = kubernetes_namespace.platform.metadata[0].name
  }

  spec {
    hard = {
      "requests.cpu"    = var.quota_requests_cpu
      "requests.memory" = var.quota_requests_memory
      "limits.cpu"      = var.quota_limits_cpu
      "limits.memory"   = var.quota_limits_memory
      "pods"            = var.quota_max_pods
    }
  }
}

resource "kubernetes_limit_range" "platform" {
  metadata {
    name      = "sa-platform-limits"
    namespace = kubernetes_namespace.platform.metadata[0].name
  }

  spec {
    limit {
      type = "Container"
      default_request = {
        cpu    = var.limit_default_request_cpu
        memory = var.limit_default_request_memory
      }
      default = {
        cpu    = var.limit_default_limit_cpu
        memory = var.limit_default_limit_memory
      }
    }
  }
}

# --- RBAC: acceso de minimo privilegio del ServiceAccount de ArgoCD sobre
#     ESTE namespace unicamente (no cluster-admin, no cluster-wide). Esto es
#     lo que reemplaza, en el modelo GitOps, al "kubectl apply"/"helm
#     upgrade" que P7 ejecutaba manualmente: quien tiene permiso real de
#     escribir en el namespace ahora es la cuenta de servicio de ArgoCD, no
#     un runner de GitHub Actions. ---
resource "kubernetes_role" "argocd_deployer" {
  metadata {
    name      = "argocd-deployer"
    namespace = kubernetes_namespace.platform.metadata[0].name
  }

  rule {
    api_groups = [""]
    resources  = ["configmaps", "secrets", "services", "serviceaccounts", "pods", "persistentvolumeclaims"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }

  rule {
    api_groups = ["apps"]
    resources  = ["deployments", "replicasets"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }

  rule {
    api_groups = ["batch"]
    resources  = ["cronjobs", "jobs"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }

  rule {
    api_groups = ["autoscaling"]
    resources  = ["horizontalpodautoscalers"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }

  rule {
    api_groups = ["policy"]
    resources  = ["poddisruptionbudgets"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }

  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses", "networkpolicies"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }

  rule {
    api_groups = ["rbac.authorization.k8s.io"]
    resources  = ["roles", "rolebindings"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }

  # Argo Rollouts (Fase 4): Rollout, AnalysisTemplate, AnalysisRun.
  rule {
    api_groups = ["argoproj.io"]
    resources  = ["rollouts", "analysistemplates", "analysisruns", "experiments"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
}

resource "kubernetes_role_binding" "argocd_deployer" {
  metadata {
    name      = "argocd-deployer-binding"
    namespace = kubernetes_namespace.platform.metadata[0].name
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.argocd_deployer.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = var.argocd_service_account_name
    namespace = var.argocd_namespace
  }
}
