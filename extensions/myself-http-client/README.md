# Local HTTP Client

Use **Send Local HTTP Request…** from the editor toolbar or the Files overflow menu in a trusted local window. Choose GET or POST, enter a URL, and confirm the displayed loopback endpoint and path. Each confirmation sends one request. POST takes one line of UTF-8 text and sends it as `text/plain`.

Use `http://127.0.0.1` or `https://[::1]` with the port and path of your local API. The client accepts only those two literal addresses. The entered query is included in the current request and omitted from confirmation text. URLs, bodies and responses are kept in memory for the current action and visible response. The panel shows the status and UTF-8 body as plain text. The client makes no automatic requests and keeps no request history.

Input URLs are limited to 2048 characters and POST bodies to 16 KiB. Response headers are limited to 8 KiB and the panel shows at most 64 KiB of response bytes. Transfers have a 10-second deadline. Cancel closes the connection on the client side. A server that already received a POST may still finish processing it.

The transport connects directly to the selected loopback literal. Redirects are displayed as responses, without following the Location header. HTTPS uses normal certificate verification for the address in use. Workspace Trust and the local-window check apply before input and again before dispatch.

## Build and install locally

From the fork with its pinned development dependencies installed:

```sh
pnpm --dir extensions/myself-http-client run test
cd extensions/myself-http-client
../../build/node_modules/.bin/vsce package --no-dependencies --allow-missing-repository --out ../../myself-http-client.vsix
```

Choose **Install from VSIX…** in the Extensions view and select the generated file. The optional extension works with Nerded Code based on Code OSS 1.146 or newer.
