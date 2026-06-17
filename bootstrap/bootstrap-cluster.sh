#!/usr/bin/env sh
set -eu

ARGOCD_NAMESPACE="${ARGOCD_NAMESPACE:-argocd}"
ARGOCD_HELM_RELEASE="${ARGOCD_HELM_RELEASE:-argocd}"
ARGOCD_CHART_VERSION="${ARGOCD_CHART_VERSION:-}"
INSTALL_ARGOCD="${INSTALL_ARGOCD:-auto}"
APPLY_ROOT="${APPLY_ROOT:-true}"
WAIT_ARGOCD="${WAIT_ARGOCD:-true}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-300s}"
ROOT_MANIFEST="${ROOT_MANIFEST:-argocd/root.yaml}"

log() {
  printf '%s\n' "bootstrap: $*"
}

die() {
  printf '%s\n' "bootstrap: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

argocd_ready() {
  kubectl get namespace "$ARGOCD_NAMESPACE" >/dev/null 2>&1 &&
    kubectl get crd applications.argoproj.io >/dev/null 2>&1 &&
    kubectl -n "$ARGOCD_NAMESPACE" get deployment argocd-server >/dev/null 2>&1 &&
    kubectl -n "$ARGOCD_NAMESPACE" get deployment argocd-repo-server >/dev/null 2>&1
}

install_argocd() {
  require_cmd helm

  log "installing Argo CD into namespace ${ARGOCD_NAMESPACE}"
  helm repo add argo https://argoproj.github.io/argo-helm >/dev/null
  helm repo update argo >/dev/null

  if [ -n "$ARGOCD_CHART_VERSION" ]; then
    helm upgrade --install "$ARGOCD_HELM_RELEASE" argo/argo-cd \
      --namespace "$ARGOCD_NAMESPACE" \
      --create-namespace \
      --version "$ARGOCD_CHART_VERSION"
  else
    helm upgrade --install "$ARGOCD_HELM_RELEASE" argo/argo-cd \
      --namespace "$ARGOCD_NAMESPACE" \
      --create-namespace
  fi
}

wait_for_argocd() {
  log "waiting for Argo CD core workloads"
  kubectl -n "$ARGOCD_NAMESPACE" rollout status deployment/argocd-server --timeout="$WAIT_TIMEOUT"
  kubectl -n "$ARGOCD_NAMESPACE" rollout status deployment/argocd-repo-server --timeout="$WAIT_TIMEOUT"

  if kubectl -n "$ARGOCD_NAMESPACE" get statefulset argocd-application-controller >/dev/null 2>&1; then
    kubectl -n "$ARGOCD_NAMESPACE" rollout status statefulset/argocd-application-controller --timeout="$WAIT_TIMEOUT"
  fi

  if kubectl -n "$ARGOCD_NAMESPACE" get deployment argocd-applicationset-controller >/dev/null 2>&1; then
    kubectl -n "$ARGOCD_NAMESPACE" rollout status deployment/argocd-applicationset-controller --timeout="$WAIT_TIMEOUT"
  fi
}

require_cmd kubectl
kubectl version --client >/dev/null
kubectl cluster-info >/dev/null

case "$INSTALL_ARGOCD" in
auto)
  if argocd_ready; then
    log "Argo CD already exists in namespace ${ARGOCD_NAMESPACE}; skipping install"
  elif kubectl get namespace "$ARGOCD_NAMESPACE" >/dev/null 2>&1; then
    die "namespace ${ARGOCD_NAMESPACE} exists but expected Argo CD resources were not found; set INSTALL_ARGOCD=true to force Helm install or fix the existing installation"
  else
    install_argocd
  fi
  ;;
true)
  install_argocd
  ;;
false)
  log "INSTALL_ARGOCD=false; skipping Argo CD install"
  ;;
*)
  die "INSTALL_ARGOCD must be auto, true, or false"
  ;;
esac

if [ "$WAIT_ARGOCD" = "true" ]; then
  argocd_ready || die "Argo CD is not ready enough to apply ${ROOT_MANIFEST}"
  wait_for_argocd
fi

if [ "$APPLY_ROOT" = "true" ]; then
  argocd_ready || die "Argo CD Application CRD is not available; cannot apply ${ROOT_MANIFEST}"
  [ -f "$ROOT_MANIFEST" ] || die "root manifest not found: ${ROOT_MANIFEST}"
  log "applying ${ROOT_MANIFEST}"
  kubectl apply -f "$ROOT_MANIFEST"
else
  log "APPLY_ROOT=false; root application was not applied"
fi

log "done"
