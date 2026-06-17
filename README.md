# Mini Book Hub GitOps

This repo owns Kubernetes/GitOps desired state.

Argo CD will sync from this repo. It does not contain application source code,
Terraform, Ansible, or full platform bootstrap automation. It includes a small
day-0 helper for installing Argo CD on a fresh cluster and applying the root
application.

## Lifecycle

```text
desired state -> validate manifests -> Argo CD sync
```

This repo now includes a fixed local/dev sandbox for Mini Book Hub runtime
resources, basic monitoring, ServiceMonitors, and SLO-backed canary templates.
It does not build application images, implement the real ApplicationSet plugin
service, add production promotion, HPA, NetworkPolicy, or alert routing.

## Layout

- `argocd`: future Argo CD root and app definitions.
- `apps/mini-book-hub`: desired-state folders for frontend and backend services.
- `bootstrap`: day-0 cluster bootstrap helper and migration notes.
- `platform`: platform notes for monitoring and Argo Rollouts.
- `preview-metadata`: pull request preview metadata examples and contract notes.
- `image-locks`: stable image digest examples for main and staging.
- `schemas`: JSON schemas for preview metadata, image locks, plugin output, and smoke config.
- `preview-smoke`: preview smoke ConfigMap, Job, and script skeleton.

Each Mini Book Hub component has `base` plus `local`, `staging`, `prod`, and `preview` overlays.

## Bootstrap / Migration

The root application assumes Argo CD already exists in the cluster. For a fresh
cluster, run the bootstrap helper from this repository root:

```sh
./bootstrap/bootstrap-cluster.sh
```

If Argo CD is already installed in namespace `argocd`, the helper skips the
install and applies `argocd/root.yaml`. If a platform team owns Argo CD
installation, use:

```sh
INSTALL_ARGOCD=false ./bootstrap/bootstrap-cluster.sh
```

The bootstrap helper does not build application images, install the future
ApplicationSet plugin generator, or promote image locks. Those remain separate
platform/pipeline phases.

## Local/Dev Runtime

The local/dev environment is managed in namespace `mini-book-hub-local`.

Argo CD root application `argocd/root.yaml` points at `argocd/apps`, which includes only the local/dev child Applications for this phase:

- `argo-rollouts`
- `monitoring`
- `mini-book-hub-local-env`
- `book-service-local`
- `reader-service-local`
- `order-service-local`
- `frontend-local`
- `ingress-local`

The local Ingress uses host `mini-book-hub.local` with direct paths:

```text
/       -> frontend:80
/book   -> book-service:3000
/reader -> reader-service:3000
/order  -> order-service:3000
```

Map `mini-book-hub.local` to the local ingress controller IP manually if local DNS is not already configured.

Backend Rollouts use Prometheus-backed AnalysisTemplates. The monitoring
Application installs kube-prometheus-stack and Prometheus discovers backend
`ServiceMonitor` resources across namespaces.

## Preview Flow

```text
app CI writes preview metadata
-> ApplicationSet plugin reads metadata, image locks, and preview-ready label
-> ApplicationSet creates per-component preview Applications
-> Argo CD syncs namespace pr-<number>
-> preview smoke Job runs inside that namespace
-> user approves or rejects manually based on smoke result
```
