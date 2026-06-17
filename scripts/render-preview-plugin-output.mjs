import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = resolve(dirname(scriptPath), "..");
const components = ["frontend", "book-service", "reader-service", "order-service"];
const previewProfiles = [...components, "network-runtime"];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function renderPreviewPluginOutput(metadataPath, repoRoot = defaultRepoRoot) {
  const metadata = await readJson(resolve(repoRoot, metadataPath));
  const imageLock = await readJson(resolve(repoRoot, metadata.stableImageLock));

  assert(metadata.status === "preview-ready", `${metadataPath} is not preview-ready`);
  assert(previewProfiles.includes(metadata.previewProfile), `${metadataPath} has unknown previewProfile`);
  assert(Array.isArray(metadata.smokeProfiles), `${metadataPath} smokeProfiles must be an array`);
  for (const smokeProfile of metadata.smokeProfiles) {
    assert(previewProfiles.includes(smokeProfile), `${metadataPath} has unknown smokeProfile ${smokeProfile}`);
  }
  assert(Array.isArray(metadata.affectedComponents), `${metadataPath} affectedComponents must be an array`);

  const affected = new Set(metadata.affectedComponents);
  for (const component of affected) {
    assert(components.includes(component), `${metadataPath} has unknown affected component ${component}`);
    assert(
      Object.hasOwn(metadata.candidateImages, component),
      `${metadataPath} missing candidate image for ${component}`
    );
  }

  for (const component of Object.keys(metadata.candidateImages)) {
    assert(affected.has(component), `${metadataPath} has candidate image for unaffected component ${component}`);
  }

  const images = {};
  for (const component of components) {
    images[component] = affected.has(component)
      ? metadata.candidateImages[component]
      : imageLock.images[component];
  }

  return {
    pr: String(metadata.pr),
    previewProfile: metadata.previewProfile,
    namespace: `pr-${metadata.pr}`,
    applicationName: `preview-pr-${metadata.pr}-${metadata.previewProfile}`,
    affectedComponents: metadata.affectedComponents.join(","),
    smokeProfiles: metadata.smokeProfiles.join(","),
    images
  };
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const metadataPath = process.argv[2];
  assert(metadataPath, "usage: node scripts/render-preview-plugin-output.mjs <metadata-path>");

  const output = await renderPreviewPluginOutput(metadataPath);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}
