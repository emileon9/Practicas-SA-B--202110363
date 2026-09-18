{{/* Nombre corto usado en Service/Deployment/etc. de este subchart. */}}
{{- define "ms-notifications.name" -}}
ms-notifications
{{- end -}}

{{/* Labels estandar aplicadas a todos los objetos de este subchart. */}}
{{- define "ms-notifications.labels" -}}
app: ms-notifications
app.kubernetes.io/name: ms-notifications
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: sa-platform
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
