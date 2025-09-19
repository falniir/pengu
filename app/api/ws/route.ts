export const runtime = "edge";
export const dynamic = "force-dynamic";
// Optional: pick a home/region for stickiness (or leave "auto")
export const preferredRegion = "auto";

type Msg =
  | { type: "ping" }
  | { type: "hello"; id: string }
  | { type: "state"; x: number; y: number }
  | { type: "broadcast"; [k: string]: unknown };

declare global {
  // eslint-disable-next-line no-var
  var __WS_CLIENTS: Set<WebSocket> | undefined;
}

const clients = (globalThis.__WS_CLIENTS ??= new Set<WebSocket>());

function broadcast(data: unknown, except?: WebSocket) {
  const payload = JSON.stringify(data);
  for (const ws of clients) {
    if (ws !== except && ws.readyState === ws.OPEN) {
      try { ws.send(payload); } catch {}
    }
  }
}

export function GET(req: Request): Response {
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Upgrade Required", { status: 426 });
  }

  const pair = new WebSocketPair() as unknown as { 0: WebSocket; 1: WebSocket };
  const client = pair[0];
  const server = pair[1];

  const id = crypto.randomUUID();

  server.accept();
  clients.add(server);

  server.send(JSON.stringify({ type: "hello", id } satisfies Msg));

  // Heartbeat to keep connections healthy
  const interval = setInterval(() => {
    try { server.send(JSON.stringify({ type: "ping" } satisfies Msg)); } catch { /* closed */ }
  }, 25_000);

  server.addEventListener("message", (ev: MessageEvent) => {
    try {
      const data = typeof ev.data === "string" ? ev.data : "";
      if (!data) return;
      const msg = JSON.parse(data) as Msg;

      switch (msg.type) {
        case "ping":
          server.send(JSON.stringify({ type: "pong" }));
          break;
        case "state":
          broadcast({ type: "state", id, x: msg.x, y: msg.y }, server);
          break;
        default:
          broadcast({ type: "broadcast", id, msg }, server);
      }
    } catch { /* ignore malformed */ }
  });

  function cleanup() {
    clearInterval(interval);
    clients.delete(server);
    broadcast({ type: "left", id });
  }

  server.addEventListener("close", cleanup);
  server.addEventListener("error", cleanup);

  return new Response(null, { status: 101, webSocket: client });
}