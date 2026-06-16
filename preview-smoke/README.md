# Preview Smoke

The preview smoke Job runs inside a `pr-<number>` namespace after Argo CD syncs preview resources.

The script supports these profiles:

```text
frontend
book-service
reader-service
order-service
network-runtime
```

The Job exits with a non-zero status when any curl check fails. Users inspect the Job logs and approve or reject manually.

`frontend` currently performs a basic HTTP check and leaves browser-level checks as a TODO for a later Playwright stage.

`configmap.yaml` includes both the smoke configuration values and the `preview-smoke-scripts` ConfigMap used by `job.yaml`. The standalone `scripts/preview-smoke.sh` file is kept as the reviewable source script.
