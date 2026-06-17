# Mini Book Hub Preview Bundles

These Kustomize bundles implement the hybrid PR preview topology.

The ApplicationSet plugin emits one preview runtime item per PR. `previewProfile` selects one of these bundles, while the plugin-resolved image map decides which components use candidate image digests and which use stable image-lock digests.

Bundle contents:

```text
frontend        -> frontend
book-service    -> book-service
reader-service  -> reader-service
order-service   -> order-service, book-service, reader-service
network-runtime -> frontend, book-service, reader-service, order-service
```

For example, a PR that changes `order-service`, `book-service`, or `reader-service` uses the `order-service` bundle when the PR gate needs to run the order integration flow. The changed component gets its candidate image; unchanged dependencies use stable image-lock images.

Leaf service bundles remain available for isolated smoke checks, but PR impact metadata can select a broader bundle when a changed leaf service must be tested through a consumer.
