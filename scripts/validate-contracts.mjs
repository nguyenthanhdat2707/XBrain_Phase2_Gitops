import { readFile } from "node:fs/promises";
import { renderPreviewPluginOutput } from "./render-preview-plugin-output.mjs";

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
  "preview-metadata/examples/appset-plugin-output-book-service.json",
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
    "previewProfile",
    "smokeProfiles",
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
  assert(smokeProfiles.includes(doc.previewProfile), `${path} unknown previewProfile`);
  assert(Array.isArray(doc.smokeProfiles) && doc.smokeProfiles.length > 0, `${path} no smokeProfiles`);
  for (const smokeProfile of doc.smokeProfiles) {
    assert(smokeProfiles.includes(smokeProfile), `${path} unknown smokeProfile ${smokeProfile}`);
  }

  for (const component of doc.affectedComponents) {
    assert(components.includes(component), `${path} unknown affected component ${component}`);
    assert(Object.hasOwn(doc.candidateImages, component), `${path} missing candidate image for ${component}`);
    assertDigestImage(doc.candidateImages[component], `${path}.candidateImages.${component}`);
  }

  const previewCanRunOrderFlow = ["order-service", "network-runtime"].includes(doc.previewProfile);

  if (doc.affectedComponents.includes("book-service")) {
    assert(previewCanRunOrderFlow, `${path} book-service changes must deploy an order-flow-capable preview`);
    assert(doc.smokeProfiles.includes("book-service"), `${path} book-service changes must smoke book-service`);
    assert(doc.smokeProfiles.includes("order-service"), `${path} book-service changes must smoke order-service`);
  }

  if (doc.affectedComponents.includes("reader-service")) {
    assert(previewCanRunOrderFlow, `${path} reader-service changes must deploy an order-flow-capable preview`);
    assert(doc.smokeProfiles.includes("reader-service"), `${path} reader-service changes must smoke reader-service`);
    assert(doc.smokeProfiles.includes("order-service"), `${path} reader-service changes must smoke order-service`);
  }

  if (doc.affectedComponents.includes("order-service")) {
    assert(previewCanRunOrderFlow, `${path} order-service changes must deploy an order-flow-capable preview`);
    assert(doc.smokeProfiles.includes("order-service"), `${path} order-service changes must smoke order-service`);
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
  assert(smokeProfiles.includes(doc.previewProfile), `${path} unknown previewProfile`);
  assert(doc.namespace === `pr-${doc.pr}`, `${path} namespace must be pr-${doc.pr}`);
  assert(doc.applicationName === `preview-pr-${doc.pr}-${doc.previewProfile}`, `${path} invalid applicationName`);
  assert(typeof doc.smokeProfiles === "string" && doc.smokeProfiles.length > 0, `${path} missing smokeProfiles`);
  for (const smokeProfile of doc.smokeProfiles.split(",")) {
    assert(smokeProfiles.includes(smokeProfile), `${path} unknown smokeProfile ${smokeProfile}`);
  }

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
validatePluginOutput(
  await readJson("preview-metadata/examples/appset-plugin-output-book-service.json"),
  "preview-metadata/examples/appset-plugin-output-book-service.json"
);

const generatedPluginOutput = await renderPreviewPluginOutput("preview-metadata/examples/pr-order-service.json");
const expectedPluginOutput = await readJson("preview-metadata/examples/appset-plugin-output-order-service.json");
assert(
  JSON.stringify(generatedPluginOutput) === JSON.stringify(expectedPluginOutput),
  "generated order-service plugin output must match example"
);

const generatedBookPluginOutput = await renderPreviewPluginOutput("preview-metadata/examples/pr-book-service.json");
const expectedBookPluginOutput = await readJson("preview-metadata/examples/appset-plugin-output-book-service.json");
assert(
  JSON.stringify(generatedBookPluginOutput) === JSON.stringify(expectedBookPluginOutput),
  "generated book-service plugin output must match example"
);

const smokeConfig = await readText("preview-smoke/configmap.yaml");
for (const key of [
  "PR_NUMBER",
  "AFFECTED_COMPONENTS",
  "SMOKE_PROFILES",
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
