# Argo CD Apps

This directory contains Argo CD child Applications.

Argo CD itself is a day-0 prerequisite. Use `../../bootstrap/bootstrap-cluster.sh`
for a fresh cluster, or apply `../root.yaml` directly when Argo CD already
exists.

`kustomization.yaml` includes the local/dev Applications plus preview runtime control plane resources:

```text
argo-rollouts
monitoring
preview-plugin
mini-book-hub-preview
mini-book-hub-local-env
book-service-local
reader-service-local
order-service-local
frontend-local
ingress-local
```

`monitoring.yaml` installs kube-prometheus-stack. Backend local Applications
include ServiceMonitor and AnalysisTemplate resources for canary SLO checks.

`preview-plugin.yaml` installs the ApplicationSet Plugin Generator service. `preview-appset.yaml` defines the pull request preview ApplicationSet that calls it.

The preview ApplicationSet is hybrid: it creates one runtime Application per PR preview, selected by `previewProfile`. For example, a PR affecting only `order-service` should render:

```text
preview-pr-123-order-service -> namespace pr-123
```

That Application syncs `apps/mini-book-hub/previews/order-service`, which includes `order-service` plus the stable `book-service` and `reader-service` dependencies needed for smoke checks. It does not deploy `frontend` for that backend-only profile.

The plugin must return these fields for each generated item:

```text
pr
previewProfile
namespace
applicationName
affectedComponents
smokeProfiles
images.frontend
images.book-service
images.reader-service
images.order-service
```

Stable images come from `image-locks/main.json`. Candidate images from `preview-metadata/pr-<number>.json` override stable images only for affected components.

PR impact graph:

```text
book-service changed   -> previewProfile=order-service, smokeProfiles=book-service,order-service
reader-service changed -> previewProfile=order-service, smokeProfiles=reader-service,order-service
order-service changed  -> previewProfile=order-service, smokeProfiles=order-service
frontend changed       -> previewProfile=frontend, smokeProfiles=frontend
```

If frontend and backend components change together, the plugin should select `network-runtime` so the namespace contains the full runtime.

Each generated Application uses multiple sources:

```text
apps/mini-book-hub/previews/<previewProfile>
preview-smoke
```

The preview runtime source receives all resolved images through Argo CD Kustomize image overrides. The smoke source receives PR number, affected components, and smoke profiles through Kustomize patches.

## Preview cleanup

Preview cleanup is driven by the same ApplicationSet plugin that creates previews. The plugin only returns metadata for PRs that are both open and labeled `preview-ready`.

That gives two cleanup paths:

```text
PR merged or closed       -> GitHub PR state is no longer open -> plugin skips it
preview-ready removed    -> readiness gate is no longer true   -> plugin skips it
```

When the plugin stops returning a PR, `mini-book-hub-preview` stops generating the matching `preview-pr-<N>-<profile>` Application. The generated Application has `resources-finalizer.argocd.argoproj.io`, so deleting the Application cascades to its preview runtime resources.

Each preview Application also sets `managedNamespaceMetadata` for its dedicated `pr-<N>` namespace. This adds Argo CD tracking metadata to the namespace created by `CreateNamespace=true`, allowing the namespace to be cleaned with the rest of the preview resources.

Use label removal as a manual kill switch when a PR stays open but the preview should stop, for example when the branch is paused, the preview is too expensive, or the PR is converted to documentation-only work.
