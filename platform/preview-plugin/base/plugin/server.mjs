import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { buildPluginResponse, PreviewPluginError } from "./preview-plugin.mjs";

const port = Number.parseInt(process.env.PORT || "4355", 10);
const tokenFile = process.env.TOKEN_FILE || "/var/run/argo/token";
const githubTokenFile = process.env.GITHUB_TOKEN_FILE || "/var/run/github/token";

async function readOptionalFile(path) {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function readPluginToken() {
  return process.env.PLUGIN_TOKEN || readOptionalFile(tokenFile);
}

async function readGitHubToken() {
  return process.env.GITHUB_TOKEN || readOptionalFile(githubTokenFile);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw new PreviewPluginError("request body too large", 413);
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json"
  });
  response.end(JSON.stringify(body));
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "text/plain"
  });
  response.end(body);
}

async function handleRequest(request, response) {
  if (request.method === "GET" && request.url === "/healthz") {
    sendText(response, 200, "ok\n");
    return;
  }

  if (request.method === "GET" && request.url === "/readyz") {
    const token = await readPluginToken();
    sendText(response, token ? 200 : 503, token ? "ready\n" : "missing plugin token\n");
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/v1/getparams.execute") {
    sendText(response, 404, "not found\n");
    return;
  }

  const pluginToken = await readPluginToken();
  if (!pluginToken) {
    sendJson(response, 500, { error: "plugin token is not configured" });
    return;
  }

  if (request.headers.authorization !== `Bearer ${pluginToken}`) {
    sendJson(response, 403, { error: "forbidden" });
    return;
  }

  const requestBody = await readJsonBody(request);
  const githubToken = await readGitHubToken();
  const pluginResponse = await buildPluginResponse({ requestBody, githubToken });

  sendJson(response, 200, pluginResponse);
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    const statusCode = error instanceof PreviewPluginError ? error.statusCode : 500;
    console.error(error);
    sendJson(response, statusCode, { error: error.message || "internal error" });
  });
});

server.listen(port, () => {
  console.log(`mini-book-hub preview plugin listening on :${port}`);
});
