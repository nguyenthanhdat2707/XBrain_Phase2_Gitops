# Cluster Bootstrap

This folder documents the day-0 path for a new cluster.

The GitOps root application assumes Argo CD already exists. On a cluster that
already has Argo CD installed, bootstrap can skip installation and only apply
the root application. On a fresh cluster, bootstrap installs Argo CD first, then
applies the root application.

## Existing Cluster

If Argo CD is already installed in namespace `argocd`:

```sh
kubectl apply -f argocd/root.yaml
```

The root application points at `argocd/apps`, which includes the local/dev stack,
Argo Rollouts, monitoring, and preview runtime control plane resources.

## Fresh Cluster

Run from the repository root:

```sh
./bootstrap/bootstrap-cluster.sh
```

The script:

- checks that `kubectl` can reach the cluster
- skips Argo CD install when the expected Argo CD resources already exist
- installs Argo CD with Helm when it is missing
- waits for core Argo CD workloads
- applies `argocd/root.yaml`

Optional environment variables:

```sh
ARGOCD_NAMESPACE=argocd
ARGOCD_HELM_RELEASE=argocd
ARGOCD_CHART_VERSION=
INSTALL_ARGOCD=auto
APPLY_ROOT=true
WAIT_ARGOCD=true
WAIT_TIMEOUT=300s
ROOT_MANIFEST=argocd/root.yaml
```

Use `INSTALL_ARGOCD=false` when a platform team owns Argo CD installation and
you only want this repository to apply the root application.

## Boundaries

This bootstrap path does not build application images or promote image locks to
staging/prod. Those are separate pipeline/platform phases.

The local/dev workloads use `Rollout` resources, so Argo Rollouts CRDs must be
present before those workloads become healthy. The root includes the
`argo-rollouts` child Application, but on a brand-new cluster it may be useful
to sync `argo-rollouts` first, then sync the app workloads again if Kubernetes
initially rejects `Rollout` resources before the CRDs are established.
