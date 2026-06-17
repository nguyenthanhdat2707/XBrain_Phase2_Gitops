# Preview Plugin

The preview plugin is an Argo CD ApplicationSet Plugin Generator service.

It exposes:

```text
POST /api/v1/getparams.execute
GET  /healthz
GET  /readyz
```

The service reads GitOps preview metadata from GitHub, verifies the source PR has the `preview-ready` label, resolves candidate and stable images, and returns ApplicationSet parameters.

Runtime input comes from `argocd/apps/preview-appset.yaml`:

```text
gitopsRepository
gitopsRevision
appRepository
metadataPath
stableImageLock
readinessLabel
```

Before syncing the plugin, create the shared auth token Secret in namespace `argocd`:

```sh
kubectl -n argocd create secret generic mini-book-hub-preview-plugin-token \
  --from-literal=token="$(openssl rand -hex 32)" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n argocd label secret mini-book-hub-preview-plugin-token \
  app.kubernetes.io/part-of=argocd --overwrite
```

For private repositories or higher GitHub API limits, also create:

```sh
kubectl -n argocd create secret generic mini-book-hub-preview-plugin-github-token \
  --from-literal=token="<github-token>" \
  --dry-run=client -o yaml | kubectl apply -f -
```

The Kubernetes manifests run `node:20-alpine` and mount the plugin source from a generated ConfigMap, so this phase does not require a custom image build.
