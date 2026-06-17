import test from "node:test";
import assert from "node:assert/strict";
import { listPreviewParameters } from "../base/plugin/preview-plugin.mjs";

function base64Json(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8").toString("base64");
}

function githubFile(value) {
  return {
    encoding: "base64",
    content: base64Json(value),
  };
}

function mockFetch(routes) {
  return async (url) => {
    const value = routes[url];
    if (value === undefined) {
      return {
        ok: false,
        status: 404,
        text: async () => "not found",
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => value,
      text: async () => JSON.stringify(value),
    };
  };
}

const requestBody = {
  input: {
    parameters: {
      githubApiBase: "https://api.github.test",
      gitopsRepository: "org/gitops",
      gitopsRevision: "main",
      appRepository: "org/app",
      metadataPath: "preview-metadata",
      stableImageLock: "image-locks/main.json",
      readinessLabel: "preview-ready",
    },
  },
};

const imageLock = {
  apiVersion: "images.mini-book-hub.io/v1",
  kind: "ImageLock",
  environment: "main-stable",
  mainSha: "main-sha",
  images: {
    frontend:
      "ghcr.io/nguyenthanhdat2707/mini-book-hub-frontend@sha256:stablefrontend",
    "book-service":
      "ghcr.io/nguyenthanhdat2707/mini-book-hub-book-service@sha256:stablebookservice",
    "reader-service":
      "ghcr.io/nguyenthanhdat2707/mini-book-hub-reader-service@sha256:stablereaderservice",
    "order-service":
      "ghcr.io/nguyenthanhdat2707/mini-book-hub-order-service@sha256:stableorderservice",
  },
};

test("resolves book-service PR into order preview runtime with stable dependencies", async () => {
  const metadata = {
    apiVersion: "preview.mini-book-hub.io/v1",
    kind: "PreviewMetadata",
    pr: 124,
    status: "preview-ready",
    baseMainSha: "base-sha",
    mergeResultSha: "merge-sha",
    affectedComponents: ["book-service"],
    candidateImages: {
      "book-service":
        "ghcr.io/nguyenthanhdat2707/mini-book-hub-book-service@sha256:candidatebookservice",
    },
    stableImageLock: "image-locks/main.json",
    previewProfile: "order-service",
    smokeProfiles: ["book-service", "order-service"],
    createdBy: {
      ciRunId: "123",
      workflow: "pr-impact-gate",
    },
  };

  const fetchImpl = mockFetch({
    "https://api.github.test/repos/org/gitops/contents/preview-metadata?ref=main":
      [
        {
          name: "pr-124.json",
          path: "preview-metadata/pr-124.json",
          type: "file",
        },
      ],
    "https://api.github.test/repos/org/gitops/contents/preview-metadata/pr-124.json?ref=main":
      githubFile(metadata),
    "https://api.github.test/repos/org/gitops/contents/image-locks/main.json?ref=main":
      githubFile(imageLock),
    "https://api.github.test/repos/org/app/issues/124": {
      state: "open",
      labels: [{ name: "preview-ready" }],
    },
  });

  assert.deepEqual(await listPreviewParameters({ requestBody, fetchImpl }), [
    {
      pr: "124",
      previewProfile: "order-service",
      namespace: "pr-124",
      applicationName: "preview-pr-124-order-service",
      affectedComponents: "book-service",
      smokeProfiles: "book-service,order-service",
      images: {
        frontend:
          "ghcr.io/nguyenthanhdat2707/mini-book-hub-frontend@sha256:stablefrontend",
        "book-service":
          "ghcr.io/nguyenthanhdat2707/mini-book-hub-book-service@sha256:candidatebookservice",
        "reader-service":
          "ghcr.io/nguyenthanhdat2707/mini-book-hub-reader-service@sha256:stablereaderservice",
        "order-service":
          "ghcr.io/nguyenthanhdat2707/mini-book-hub-order-service@sha256:stableorderservice",
      },
    },
  ]);
});

test("skips metadata when PR does not have preview-ready label", async () => {
  const metadata = {
    pr: 125,
    status: "preview-ready",
    affectedComponents: ["reader-service"],
    candidateImages: {
      "reader-service":
        "ghcr.io/nguyenthanhdat2707/mini-book-hub-reader-service@sha256:candidatereaderservice",
    },
    stableImageLock: "image-locks/main.json",
    previewProfile: "order-service",
    smokeProfiles: ["reader-service", "order-service"],
  };

  const fetchImpl = mockFetch({
    "https://api.github.test/repos/org/gitops/contents/preview-metadata?ref=main":
      [
        {
          name: "pr-125.json",
          path: "preview-metadata/pr-125.json",
          type: "file",
        },
      ],
    "https://api.github.test/repos/org/gitops/contents/preview-metadata/pr-125.json?ref=main":
      githubFile(metadata),
    "https://api.github.test/repos/org/app/issues/125": {
      state: "open",
      labels: [{ name: "needs-work" }],
    },
  });

  assert.deepEqual(await listPreviewParameters({ requestBody, fetchImpl }), []);
});

test("skips closed PR metadata even when the preview-ready label remains", async () => {
  const legacyMetadata = {
    pr: 4,
    status: "preview-ready",
    affectedComponents: ["book-service"],
    candidateImages: {
      "book-service":
        "ghcr.io/nguyenthanhdat2707/mini-book-hub-book-service@sha256:candidatebookservice",
    },
    stableImageLock: "image-locks/main.json",
    smokeProfile: "network-runtime",
  };

  const fetchImpl = mockFetch({
    "https://api.github.test/repos/org/gitops/contents/preview-metadata?ref=main":
      [
        {
          name: "pr-4.json",
          path: "preview-metadata/pr-4.json",
          type: "file",
        },
      ],
    "https://api.github.test/repos/org/gitops/contents/preview-metadata/pr-4.json?ref=main":
      githubFile(legacyMetadata),
    "https://api.github.test/repos/org/app/issues/4": {
      state: "closed",
      labels: [{ name: "preview-ready" }],
    },
  });

  assert.deepEqual(await listPreviewParameters({ requestBody, fetchImpl }), []);
});
