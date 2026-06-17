# Argo CD Apps

This directory contains Argo CD child Applications.

Argo CD itself is a day-0 prerequisite. Use `../../bootstrap/bootstrap-cluster.sh`
for a fresh cluster, or apply `../root.yaml` directly when Argo CD already
exists.

`kustomization.yaml` includes only the local/dev Applications for this phase:

```text
argo-rollouts
monitoring
mini-book-hub-local-env
book-service-local
reader-service-local
order-service-local
frontend-local
ingress-local
```

`preview-appset.yaml` is intentionally not included yet.

`monitoring.yaml` installs kube-prometheus-stack. Backend local Applications
include ServiceMonitor and AnalysisTemplate resources for canary SLO checks.

`preview-appset.yaml` defines the expected ApplicationSet Plugin Generator contract for pull request preview environments. The plugin service is intentionally not implemented in this phase.

The preview ApplicationSet is per-component. For example, a PR affecting `order-service` should render:

```text
preview-pr-123-order-service -> namespace pr-123
```

The plugin must return these fields for each generated item:

```text
pr
component
namespace
applicationName
affectedComponents
smokeProfile
images.frontend
images.book-service
images.reader-service
images.order-service
```

Stable images come from `image-locks/main.json`. Candidate images from `preview-metadata/pr-<number>.json` override stable images only for affected components.

Each generated Application uses multiple sources:

```text
apps/mini-book-hub/<component>/overlays/preview
preview-smoke
```

That keeps the preview Application per-component while still syncing the smoke Job into the same `pr-<number>` namespace.
