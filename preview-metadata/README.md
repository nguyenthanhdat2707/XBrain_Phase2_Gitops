# Preview Metadata

Preview metadata is written by app CI after a pull request merge-result build has produced candidate image digests.

Runtime files follow this pattern:

```text
preview-metadata/pr-<number>.json
```

This directory currently contains examples only. The expected contract is defined in `../schemas/preview-metadata.v1.schema.json`.

The ApplicationSet plugin generator reads preview metadata, `image-locks/main.json`, and the PR `preview-ready` label. It emits one item per PR preview runtime.

The metadata keeps `affectedComponents` as the components with candidate images from the PR merge-result. `previewProfile` selects the runtime bundle required by the impact graph, and `smokeProfiles` selects the checks to run inside that bundle.

Impact graph:

```text
book-service changed   -> previewProfile=order-service, smokeProfiles=book-service,order-service
reader-service changed -> previewProfile=order-service, smokeProfiles=reader-service,order-service
order-service changed  -> previewProfile=order-service, smokeProfiles=order-service
frontend changed       -> previewProfile=frontend, smokeProfiles=frontend
```

The emitted plugin item resolves a full `images` map: affected components use candidate digests from the preview metadata, and unchanged runtime dependencies use stable digests from the image lock.

The contract resolver can be exercised locally:

```sh
node scripts/render-preview-plugin-output.mjs preview-metadata/examples/pr-order-service.json
```
