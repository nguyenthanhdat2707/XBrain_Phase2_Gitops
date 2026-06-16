# Mini Book Hub GitOps

This repo owns Kubernetes/GitOps desired state.

Argo CD will sync from this repo. It does not contain application source code, Terraform, Ansible, or old bootstrap scripts.

## Lifecycle

```text
desired state -> validate manifests -> Argo CD sync
```

This phase only prepares the repository structure and minimal placeholders. It does not introduce final Kubernetes object design, canary, monitoring, Argo Rollouts, ApplicationSet preview, auto image updates, or smoke test jobs.

## Layout

- `argocd`: future Argo CD root and app definitions.
- `apps/mini-book-hub`: desired-state folders for frontend and backend services.
- `platform`: platform placeholders for future monitoring and Argo Rollouts.
- `preview-metadata`: placeholder for future pull request preview metadata.

Each Mini Book Hub component has `base` plus `local`, `staging`, and `psns` overlays.
