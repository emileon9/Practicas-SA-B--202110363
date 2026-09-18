# Diagrama del flujo GitOps + entrega progresiva — Práctica 8

```mermaid
flowchart TD
    DEV[Developer] -->|git tag vX.Y.Z| GH[GitHub - repo de codigo]
    GH --> CI[GitHub Actions]

    subgraph CI_PIPELINE ["GitHub Actions (nunca toca el cluster)"]
        direction TB
        T1[Tests unitarios] --> T2[helm lint]
        T2 --> T3["Trivy - bloquea CRITICAL"]
        T3 --> T4[SBOM CycloneDX]
        T4 --> T5[Build imagen]
        T5 --> T6["Cosign sign - keyless/Sigstore"]
    end

    CI --> CI_PIPELINE
    CI_PIPELINE --> REG[(Container Registry - GHCR)]
    CI_PIPELINE -->|abre PR con el nuevo tag| GITOPS_REPO[Repositorio GitOps]

    GITOPS_REPO -->|merge| ARGOCD[ArgoCD]
    ARGOCD -->|UNICO componente que aplica cambios| ROLLOUT[Argo Rollouts]

    subgraph CANARY ["Canary de gateway (3+ pasos)"]
        direction TB
        S1["10% nueva version"] --> A1{{AnalysisTemplate<br/>error rate + latencia /health}}
        A1 -->|PASS| S2["30% nueva version"]
        A1 -->|FAIL| RB[Rollback automatico<br/>100% version estable]
        S2 --> A2{{AnalysisTemplate}}
        A2 -->|PASS| S3["60% nueva version"]
        A2 -->|FAIL| RB
        S3 --> A3{{AnalysisTemplate}}
        A3 -->|PASS| S4["100% nueva version"]
        A3 -->|FAIL| RB
    end

    ROLLOUT --> CANARY
    CANARY --> K8S[(Kubernetes - namespace sa-p5)]
    RB --> K8S

    KYVERNO["Kyverno - admission control<br/>(disallow latest / root / sin limits)"] -.valida antes de admitir.-> K8S
    TF["Terraform<br/>(Namespace, ResourceQuota, LimitRange, RBAC)"] -.provisiona.-> K8S

    classDef security fill:#8b3a3a,stroke:#5a1f1f,color:#fff;
    classDef gitops fill:#2d5f8a,stroke:#1a3a54,color:#fff;
    classDef k8s fill:#2f6b3a,stroke:#1c4023,color:#fff;
    class T3,T4,T6,KYVERNO security;
    class ARGOCD,GITOPS_REPO gitops;
    class K8S,TF k8s;
```

## Dónde ocurre cada cosa

| Pregunta | Respuesta |
|---|---|
| ¿Dónde se valida? | `helm lint` + Trivy (bloquea CRITICAL) + SBOM + firma, todo en GitHub Actions, antes de que exista un PR al repo GitOps. Luego, `AnalysisTemplate` en cada paso del canary, en vivo dentro del clúster. |
| ¿Quién aplica cambios al clúster? | **Únicamente ArgoCD.** Ningún workflow de GitHub Actions ejecuta `kubectl`/`helm`/`terraform` contra el clúster (ver `P8/docs/GITOPS.md`). |
| ¿Dónde ocurre la promoción? | Dentro de Argo Rollouts, paso a paso (`setWeight: 10 → 30 → 60 → 100`), cada uno gateado por el mismo `AnalysisTemplate`. |
| ¿Dónde ocurre el rollback? | Automático, dentro de Argo Rollouts: si un `AnalysisRun` falla, el Rollout revierte el peso al 100% de la versión estable sin intervención manual (ver `P8/docs/INCIDENT.md`). |
| ¿Dónde se aplica seguridad de supply chain? | Trivy + SBOM + Cosign en el pipeline de GitHub Actions (antes de publicar la imagen); Kyverno como admission controller dentro del clúster (rechaza en el momento de creación del recurso, independientemente de por dónde haya llegado el manifiesto). |
| ¿Quién administra namespace/cuotas/RBAC? | Terraform (`P8/terraform`), fuera del ciclo de vida de las aplicaciones — se aplica una sola vez (o cuando cambia la infraestructura de plataforma), no en cada release. |
