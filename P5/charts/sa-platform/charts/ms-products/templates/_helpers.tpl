{{/* Nombre corto usado en Service/Deployment/etc. de este subchart. */}}
{{- define "ms-products.name" -}}
ms-products
{{- end -}}

{{/* Labels estandar aplicadas a todos los objetos de este subchart. */}}
{{- define "ms-products.labels" -}}
app: ms-products
app.kubernetes.io/name: ms-products
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: sa-platform
{{- end -}}
