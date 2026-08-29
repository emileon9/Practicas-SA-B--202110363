{{/* Nombre corto usado en Service/Deployment/etc. de este subchart. */}}
{{- define "gateway.name" -}}
gateway
{{- end -}}

{{/* Labels estandar aplicadas a todos los objetos de este subchart. */}}
{{- define "gateway.labels" -}}
app: gateway
app.kubernetes.io/name: gateway
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: sa-platform
{{- end -}}
