# Preview Metadata

Preview metadata is written by app CI after a pull request merge-result build has produced candidate image digests.

Runtime files follow this pattern:

```text
preview-metadata/pr-<number>.json
```

This directory currently contains examples only. The expected contract is defined in `../schemas/preview-metadata.v1.schema.json`.

The future ApplicationSet plugin generator reads preview metadata, `image-locks/main.json`, and the PR `preview-ready` label. It should emit one item per component Application to preview.
