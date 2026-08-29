{{/*
Namespace donde se instala toda la plataforma. Permite override explicito via
.Values.global.namespace; si no se define, cae al namespace del release.
*/}}
{{- define "sa-platform.namespace" -}}
{{- default .Release.Namespace .Values.global.namespace -}}
{{- end -}}

{{/*
Labels comunes aplicadas a todo objeto de la plataforma (parent chart y
subcharts propios). Solo depende de .Release y .Chart, por lo que es seguro
invocarla tanto desde el chart padre como desde cualquier subchart.
*/}}
{{- define "sa-platform.labels" -}}
app.kubernetes.io/part-of: sa-platform
app.kubernetes.io/managed-by: {{ .Release.Service | quote }}
app.kubernetes.io/instance: {{ .Release.Name | quote }}
{{- end -}}

{{/*
Nombre del Secret con las credenciales de PostgreSQL generado por el chart
padre (templates/secrets-db.yaml). Solo depende de .Release.Name, por lo que
puede invocarse igual desde un subchart de microservicio o desde un CronJob.
*/}}
{{- define "sa-platform.dbSecretName" -}}
{{- printf "%s-db-credentials" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Nombre del Secret con las credenciales de RabbitMQ generado por el chart
padre (templates/secrets-broker.yaml).
*/}}
{{- define "sa-platform.brokerSecretName" -}}
{{- printf "%s-broker-credentials" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
