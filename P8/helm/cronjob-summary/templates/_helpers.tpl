{{- define "cronjob-summary.labels" -}}
app: cronjob-summary
app.kubernetes.io/name: cronjob-summary
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: sa-platform
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
