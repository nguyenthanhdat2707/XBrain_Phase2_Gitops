const COMPONENTS = [
  "frontend",
  "book-service",
  "reader-service",
  "order-service",
];
const PREVIEW_PROFILES = [...COMPONENTS, "network-runtime"];
const METADATA_FILE_PATTERN = /^pr-[1-9][0-9]*\.json$/;

export class PreviewPluginError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "PreviewPluginError";
    this.statusCode = statusCode;
  }
}

function assert(condition, message, statusCode = 500) {
  if (!condition) {
    throw new PreviewPluginError(message, statusCode);
  }
}

function normalizePath(path) {
  return String(path || "").replace(/^\/+|\/+$/g, "");
}

function encodePath(path) {
  return normalizePath(path).split("/").map(encodeURIComponent).join("/");
}

function decodeBase64(value) {
  return Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8");
}

function githubHeaders(githubToken) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "mini-book-hub-preview-plugin",
  };

  if (githubToken) {
    headers.authorization = `Bearer ${githubToken}`;
  }

  return headers;
}

async function fetchJson(
  fetchImpl,
  url,
  githubToken,
  { allowNotFound = false } = {},
) {
  const response = await fetchImpl(url, {
    headers: githubHeaders(githubToken),
  });

  if (allowNotFound && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new PreviewPluginError(
      `GitHub request failed ${response.status} ${url}: ${body}`.trim(),
      502,
    );
  }

  return response.json();
}

async function readGitHubFile({
  fetchImpl,
  githubApiBase,
  repository,
  ref,
  path,
  githubToken,
}) {
  const url = `${githubApiBase}/repos/${repository}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
  const file = await fetchJson(fetchImpl, url, githubToken);

  assert(!Array.isArray(file), `${path} resolved to a directory`);
  assert(
    file?.encoding === "base64" && typeof file.content === "string",
    `${path} is not a base64 GitHub file`,
  );

  return JSON.parse(decodeBase64(file.content));
}

async function listPreviewMetadataFiles({
  fetchImpl,
  githubApiBase,
  repository,
  ref,
  metadataPath,
  githubToken,
}) {
  const url = `${githubApiBase}/repos/${repository}/contents/${encodePath(metadataPath)}?ref=${encodeURIComponent(ref)}`;
  const entries = await fetchJson(fetchImpl, url, githubToken, {
    allowNotFound: true,
  });

  if (entries === null) {
    return [];
  }

  assert(Array.isArray(entries), `${metadataPath} must be a GitHub directory`);

  return entries
    .filter(
      (entry) =>
        entry.type === "file" && METADATA_FILE_PATTERN.test(entry.name),
    )
    .map((entry) => entry.path)
    .sort();
}

async function isPreviewPullRequestReady({
  fetchImpl,
  githubApiBase,
  appRepository,
  pr,
  readinessLabel,
  githubToken,
}) {
  if (!appRepository) {
    return true;
  }

  const url = `${githubApiBase}/repos/${appRepository}/issues/${pr}`;
  const issue = await fetchJson(fetchImpl, url, githubToken, {
    allowNotFound: true,
  });

  if (issue === null || issue.state !== "open") {
    return false;
  }

  if (!readinessLabel) {
    return true;
  }

  return (
    Array.isArray(issue.labels) &&
    issue.labels.some((label) => label.name === readinessLabel)
  );
}

export function resolvePreviewOutput(metadata, imageLock) {
  assert(
    metadata.status === "preview-ready",
    `PR ${metadata.pr} is not preview-ready`,
  );
  assert(
    PREVIEW_PROFILES.includes(metadata.previewProfile),
    `PR ${metadata.pr} has invalid previewProfile`,
  );
  assert(
    Array.isArray(metadata.affectedComponents),
    `PR ${metadata.pr} affectedComponents must be an array`,
  );
  assert(
    Array.isArray(metadata.smokeProfiles),
    `PR ${metadata.pr} smokeProfiles must be an array`,
  );

  const affected = new Set(metadata.affectedComponents);

  for (const component of affected) {
    assert(
      COMPONENTS.includes(component),
      `PR ${metadata.pr} has invalid affected component ${component}`,
    );
    assert(
      metadata.candidateImages?.[component],
      `PR ${metadata.pr} missing candidate image for ${component}`,
    );
  }

  for (const smokeProfile of metadata.smokeProfiles) {
    assert(
      PREVIEW_PROFILES.includes(smokeProfile),
      `PR ${metadata.pr} has invalid smoke profile ${smokeProfile}`,
    );
  }

  const images = {};
  for (const component of COMPONENTS) {
    images[component] = affected.has(component)
      ? metadata.candidateImages[component]
      : imageLock.images?.[component];
    assert(
      images[component],
      `PR ${metadata.pr} missing resolved image for ${component}`,
    );
  }

  return {
    pr: String(metadata.pr),
    previewProfile: metadata.previewProfile,
    namespace: `pr-${metadata.pr}`,
    applicationName: `preview-pr-${metadata.pr}-${metadata.previewProfile}`,
    affectedComponents: metadata.affectedComponents.join(","),
    smokeProfiles: metadata.smokeProfiles.join(","),
    images,
  };
}

export async function listPreviewParameters({
  requestBody,
  fetchImpl = globalThis.fetch,
  githubToken = "",
}) {
  const parameters = requestBody?.input?.parameters ?? {};
  const githubApiBase = parameters.githubApiBase || "https://api.github.com";
  const gitopsRepository = parameters.gitopsRepository;
  const gitopsRevision = parameters.gitopsRevision || "main";
  const appRepository = parameters.appRepository || "";
  const metadataPath = normalizePath(
    parameters.metadataPath || "preview-metadata",
  );
  const stableImageLock = normalizePath(
    parameters.stableImageLock || "image-locks/main.json",
  );
  const readinessLabel = parameters.readinessLabel || "preview-ready";

  assert(
    gitopsRepository,
    "input.parameters.gitopsRepository is required",
    400,
  );

  const metadataFiles = await listPreviewMetadataFiles({
    fetchImpl,
    githubApiBase,
    repository: gitopsRepository,
    ref: gitopsRevision,
    metadataPath,
    githubToken,
  });

  const imageLocks = new Map();
  const outputs = [];

  for (const metadataFile of metadataFiles) {
    const metadata = await readGitHubFile({
      fetchImpl,
      githubApiBase,
      repository: gitopsRepository,
      ref: gitopsRevision,
      path: metadataFile,
      githubToken,
    });

    if (metadata.status !== "preview-ready") {
      continue;
    }

    const isReady = await isPreviewPullRequestReady({
      fetchImpl,
      githubApiBase,
      appRepository,
      pr: metadata.pr,
      readinessLabel,
      githubToken,
    });

    if (!isReady) {
      continue;
    }

    const imageLockPath = normalizePath(
      metadata.stableImageLock || stableImageLock,
    );
    if (!imageLocks.has(imageLockPath)) {
      imageLocks.set(
        imageLockPath,
        await readGitHubFile({
          fetchImpl,
          githubApiBase,
          repository: gitopsRepository,
          ref: gitopsRevision,
          path: imageLockPath,
          githubToken,
        }),
      );
    }

    outputs.push(resolvePreviewOutput(metadata, imageLocks.get(imageLockPath)));
  }

  outputs.sort(
    (left, right) =>
      Number(left.pr) - Number(right.pr) ||
      left.previewProfile.localeCompare(right.previewProfile),
  );

  return outputs;
}

export async function buildPluginResponse(options) {
  return {
    output: {
      parameters: await listPreviewParameters(options),
    },
  };
}
