# Frontend Base

Base desired state for the Mini Book Hub frontend Rollout, Service, and runtime ConfigMap.

The local overlay mounts `frontend-config` over `/usr/share/nginx/html/app.js` so the browser calls APIs through the local Ingress paths.
