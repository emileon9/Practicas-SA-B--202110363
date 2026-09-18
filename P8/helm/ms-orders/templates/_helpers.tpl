{{/* Nombre corto usado en Service/Deployment/etc. de este subchart. */}}
{{- define "ms-orders.name" -}}
ms-orders
{{- end -}}

{{/* Labels estandar aplicadas a todos los objetos de este subchart. */}}
{{- define "ms-orders.labels" -}}
app: ms-orders
app.kubernetes.io/name: ms-orders
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: sa-platform
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
