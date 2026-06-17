# Monitoring

Monitoring is installed through the Argo CD child Application at
`argocd/apps/monitoring.yaml`.

This phase installs kube-prometheus-stack with Prometheus Operator CRDs and a
Prometheus server. Grafana and Alertmanager are disabled to keep the local/dev
runtime small.

Backend services define ServiceMonitor resources and Argo Rollouts
AnalysisTemplates that query Prometheus for:

- metrics presence
- HTTP 5xx request rate
- p95 request latency

PrometheusRule, dashboard, and alert routing design remain future work.
