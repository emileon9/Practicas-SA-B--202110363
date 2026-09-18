{{/* Nombre corto usado en Service/Deployment/etc. de este subchart. */}}
{{- define "ms-users.name" -}}
ms-users
{{- end -}}

{{/* Labels estandar aplicadas a todos los objetos de este subchart. */}}
{{- define "ms-users.labels" -}}
app: ms-users
app.kubernetes.io/name: ms-users
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: sa-platform
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
