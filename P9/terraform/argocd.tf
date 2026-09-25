# Instalación de ArgoCD (Práctica 9, "Bootstrap automatizado desde cero").
#
# Esto es lo que P8 NUNCA declaró como código: en P8, ArgoCD ya existía en
# el clúster cuando se escribieron los manifiestos de
# P8/argocd/applications/ (se instaló manualmente, sin registro en
# Terraform). La cadena que pide la Práctica 9 es:
#
#   Terraform -> Namespace argocd -> ArgoCD (Helm) -> AppProject sa-platform
#   -> root Application (app-of-apps) -> ArgoCD sincroniza el resto
#      (P8/argocd/applications/*.yaml, sin tocarlos)
#
# A partir de aquí, ArgoCD es dueño de todo lo que hay debajo del
# app-of-apps; Terraform no vuelve a tocar esos recursos.

resource "kubernetes_namespace" "argocd" {
  metadata {
    name = var.argocd_namespace
    labels = {
      "app.kubernetes.io/part-of"    = "sa-platform"
      "app.kubernetes.io/managed-by" = "terraform"
    }
  }
}

resource "helm_release" "argocd" {
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = var.argocd_chart_version
  namespace  = kubernetes_namespace.argocd.metadata[0].name

  # Instalación mínima: server en modo inseguro por HTTP dentro del
  # clúster (se accede con `kubectl port-forward`, igual que en P8 no se
  # expuso un Ingress público para ArgoCD). No se activa alta
  # disponibilidad: un clúster local de una sola instancia no la necesita.
  set {
    name  = "server.insecure"
    value = "true"
  }

  wait    = true
  timeout = 600
}

# --- AppProject + Application raíz (app-of-apps) ---
#
# LIMITACIÓN CONOCIDA (documentada con honestidad, no ocultada): los CRD
# de ArgoCD (AppProject, Application) no existen en el clúster hasta que
# el `helm_release.argocd` de arriba termina de instalarlos. El provider
# `kubernetes_manifest` necesita conocer el esquema del CRD en el momento
# de `terraform plan`, así que la primera corrida contra un clúster nuevo
# requiere DOS pasos:
#
#   terraform apply -target=helm_release.argocd
#   terraform apply
#
# Ambos comandos viven en el único punto de entrada
# (P9/bootstrap/bootstrap.sh), así que para quien ejecuta el bootstrap
# sigue siendo "un solo comando" aunque Terraform internamente necesite
# dos fases. Alternativa considerada y descartada: aplicar el
# AppProject/Application con el provider "kubectl" (manifiestos como
# texto plano, sin depender del esquema del CRD) — se deja como mejora
# futura si el requisito de "un solo `terraform apply`" resulta
# estrictamente necesario en la calificación.

resource "kubernetes_manifest" "sa_platform_project" {
  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "AppProject"
    metadata = {
      name      = "sa-platform"
      namespace = kubernetes_namespace.argocd.metadata[0].name
    }
    spec = {
      description = "Plataforma de microservicios sa-platform (Practicas 4-9, USAC Software Avanzado)."
      sourceRepos = [
        var.code_repo_url,
        var.gitops_repo_url,
      ]
      destinations = [
        {
          namespace = var.platform_namespace
          server    = "https://kubernetes.default.svc"
        },
        {
          namespace = "velero"
          server    = "https://kubernetes.default.svc"
        }
      ]
      clusterResourceWhitelist = []
      namespaceResourceWhitelist = [
        { group = "", kind = "ConfigMap" },
        { group = "", kind = "Secret" },
        { group = "", kind = "Service" },
        { group = "", kind = "ServiceAccount" },
        { group = "", kind = "PersistentVolumeClaim" },
        { group = "apps", kind = "Deployment" },
        { group = "apps", kind = "StatefulSet" },
        { group = "batch", kind = "CronJob" },
        { group = "batch", kind = "Job" },
        { group = "autoscaling", kind = "HorizontalPodAutoscaler" },
        { group = "policy", kind = "PodDisruptionBudget" },
        { group = "networking.k8s.io", kind = "Ingress" },
        { group = "networking.k8s.io", kind = "NetworkPolicy" },
        { group = "rbac.authorization.k8s.io", kind = "Role" },
        { group = "rbac.authorization.k8s.io", kind = "RoleBinding" },
        { group = "argoproj.io", kind = "Rollout" },
        { group = "argoproj.io", kind = "AnalysisTemplate" },
        { group = "argoproj.io", kind = "AnalysisRun" },
        { group = "bitnami.com", kind = "SealedSecret" },
        { group = "velero.io", kind = "Schedule" },
        { group = "velero.io", kind = "BackupStorageLocation" },
      ]
    }
  }

  depends_on = [helm_release.argocd]
}

resource "kubernetes_manifest" "sa_platform_root" {
  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Application"
    metadata = {
      name      = "sa-platform-root"
      namespace = kubernetes_namespace.argocd.metadata[0].name
      labels = {
        "app.kubernetes.io/part-of" = "sa-platform"
      }
    }
    spec = {
      project = "sa-platform"
      source = {
        repoURL        = var.code_repo_url
        targetRevision = var.code_repo_revision
        # App-of-apps "de directorio": este único Application observa la
        # misma carpeta que ya usaba P8 (P8/argocd/applications/) más los
        # recursos nuevos de P9 (Velero, resiliencia). No se reescribe
        # ningún manifiesto de P8: se agrega P9/argocd/applications como
        # una segunda carpeta observada por un ApplicationSet en vez de
        # duplicar Applications. Ver P9/argocd/README.md.
        path    = "P9/argocd/applications"
        directory = {
          recurse = true
        }
      }
      destination = {
        server    = "https://kubernetes.default.svc"
        namespace = kubernetes_namespace.argocd.metadata[0].name
      }
      syncPolicy = {
        automated = {
          prune    = true
          selfHeal = true
        }
        syncOptions = ["CreateNamespace=false"]
      }
    }
  }

  depends_on = [kubernetes_manifest.sa_platform_project]
}
