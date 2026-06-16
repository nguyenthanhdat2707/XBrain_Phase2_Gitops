# Mini Book Hub GitOps

This repo owns Kubernetes/GitOps desired state.

Argo CD will sync from this repo. It does not contain application source code, Terraform, Ansible, or old bootstrap scripts.

## Lifecycle

```text
desired state -> validate manifests -> Argo CD sync
```

This phase prepares GitOps contracts and skeletons for future pull request preview environments. It does not build application images, implement the real ApplicationSet plugin service, add production promotion, canary, or monitoring.

## Layout

- `argocd`: future Argo CD root and app definitions.
- `apps/mini-book-hub`: desired-state folders for frontend and backend services.
- `platform`: platform placeholders for future monitoring and Argo Rollouts.
- `preview-metadata`: pull request preview metadata examples and contract notes.
- `image-locks`: stable image digest examples for main and staging.
- `schemas`: JSON schemas for preview metadata, image locks, plugin output, and smoke config.
- `preview-smoke`: preview smoke ConfigMap, Job, and script skeleton.

Each Mini Book Hub component has `base` plus `local`, `staging`, `prod`, and `preview` overlays.

## Preview Flow

```text
app CI writes preview metadata
-> ApplicationSet plugin reads metadata, image locks, and preview-ready label
-> ApplicationSet creates per-component preview Applications
-> Argo CD syncs namespace pr-<number>
-> preview smoke Job runs inside that namespace
-> user approves or rejects manually based on smoke result
```
