{{- define "cronjob-heartbeat.labels" -}}
app: cronjob-heartbeat
app.kubernetes.io/name: cronjob-heartbeat
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: sa-platform
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
