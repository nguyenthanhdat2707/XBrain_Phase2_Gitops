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

`SMOKE_PROFILES` accepts a comma-separated list, so a `book-service` PR can run both `book-service` and `order-service` checks in the same preview namespace.

The Job runs as an Argo CD `PostSync` hook, exits with a non-zero status when any curl check fails, and stays available for log inspection. Users inspect the Job logs and approve or reject manually.

`frontend` currently performs a basic HTTP check and leaves browser-level checks as a TODO for a later Playwright stage.

`configmap.yaml` includes default smoke configuration values and the `preview-smoke-scripts` ConfigMap used by `job.yaml`. The ApplicationSet patches PR-specific values before sync. The standalone `scripts/preview-smoke.sh` file is kept as the reviewable source script.
