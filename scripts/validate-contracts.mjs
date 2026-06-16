import { readFile } from "node:fs/promises";

const files = [
  "schemas/preview-metadata.v1.schema.json",
  "schemas/image-lock.v1.schema.json",
  "schemas/appset-plugin-output.v1.schema.json",
  "schemas/preview-smoke-config.v1.schema.json",
  "preview-metadata/examples/pr-order-service.json",
  "preview-metadata/examples/pr-book-service.json",
  "preview-metadata/examples/pr-reader-service.json",
  "preview-metadata/examples/pr-frontend.json",
  "preview-metadata/examples/appset-plugin-output-order-service.json",
  "image-locks/main.json",
  "image-locks/staging.json"
];

const components = ["frontend", "book-service", "reader-service", "order-service"];
const smokeProfiles = [...components, "network-runtime"];
const imagePattern =
  /^ghcr\.io\/nguyenthanhdat2707\/mini-book-hub-(frontend|book-service|reader-service|order-service)@sha256:[A-Za-z0-9._-]+$/;

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

async function readText(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDigestImage(image, path) {
  assert(typeof image === "string" && imagePattern.test(image), `${path} must be a GHCR sha256 digest image`);
}

function validatePreviewMetadata(doc, path) {
  for (const key of [
    "apiVersion",
    "kind",
    "pr",
    "status",
    "baseMainSha",
    "mergeResultSha",
    "affectedComponents",
    "candidateImages",
    "stableImageLock",
    "smokeProfile",
    "createdBy"
  ]) {
    assert(Object.hasOwn(doc, key), `${path} missing ${key}`);
  }

  assert(doc.apiVersion === "preview.mini-book-hub.io/v1", `${path} invalid apiVersion`);
  assert(doc.kind === "PreviewMetadata", `${path} invalid kind`);
  assert(Number.isInteger(doc.pr) && doc.pr > 0, `${path} pr must be a positive integer`);
  assert(doc.status === "preview-ready", `${path} status must be preview-ready`);
  assert(typeof doc.baseMainSha === "string" && doc.baseMainSha.length >= 7, `${path} invalid baseMainSha`);
  assert(
    typeof doc.mergeResultSha === "string" && doc.mergeResultSha.length >= 7,
    `${path} invalid mergeResultSha`
  );
  assert(Array.isArray(doc.affectedComponents) && doc.affectedComponents.length > 0, `${path} no affectedComponents`);
  assert(smokeProfiles.includes(doc.smokeProfile), `${path} unknown smokeProfile`);

  for (const component of doc.affectedComponents) {
    assert(components.includes(component), `${path} unknown affected component ${component}`);
    assert(Object.hasOwn(doc.candidateImages, component), `${path} missing candidate image for ${component}`);
    assertDigestImage(doc.candidateImages[component], `${path}.candidateImages.${component}`);
  }
}

function validateImageLock(doc, path) {
  assert(doc.apiVersion === "images.mini-book-hub.io/v1", `${path} invalid apiVersion`);
  assert(doc.kind === "ImageLock", `${path} invalid kind`);
  assert(["main-stable", "staging"].includes(doc.environment), `${path} invalid environment`);
  assert(typeof doc.mainSha === "string" && doc.mainSha.length >= 7, `${path} invalid mainSha`);

  for (const component of components) {
    assertDigestImage(doc.images?.[component], `${path}.images.${component}`);
  }
}

function validatePluginOutput(doc, path) {
  assert(/^[1-9][0-9]*$/.test(doc.pr), `${path} invalid pr`);
  assert(components.includes(doc.component), `${path} unknown component`);
  assert(doc.namespace === `pr-${doc.pr}`, `${path} namespace must be pr-${doc.pr}`);
  assert(doc.applicationName === `preview-pr-${doc.pr}-${doc.component}`, `${path} invalid applicationName`);
  assert(smokeProfiles.includes(doc.smokeProfile), `${path} unknown smokeProfile`);

  for (const component of components) {
    assertDigestImage(doc.images?.[component], `${path}.images.${component}`);
  }
}

for (const file of files) {
  await readJson(file);
}

for (const file of files.filter((item) => item.startsWith("preview-metadata/examples/pr-"))) {
  validatePreviewMetadata(await readJson(file), file);
}

for (const file of ["image-locks/main.json", "image-locks/staging.json"]) {
  validateImageLock(await readJson(file), file);
}

validatePluginOutput(
  await readJson("preview-metadata/examples/appset-plugin-output-order-service.json"),
  "preview-metadata/examples/appset-plugin-output-order-service.json"
);

const smokeConfig = await readText("preview-smoke/configmap.yaml");
for (const key of [
  "PR_NUMBER",
  "AFFECTED_COMPONENTS",
  "SMOKE_PROFILE",
  "FRONTEND_URL",
  "BOOK_SERVICE_URL",
  "READER_SERVICE_URL",
  "ORDER_SERVICE_URL"
]) {
  assert(smokeConfig.includes(`${key}:`), `preview-smoke/configmap.yaml missing ${key}`);
}

const smokeScript = await readText("preview-smoke/scripts/preview-smoke.sh");
for (const profile of smokeProfiles) {
  assert(smokeScript.includes(`${profile})`), `preview-smoke.sh missing profile ${profile}`);
}

console.log("contracts ok");
