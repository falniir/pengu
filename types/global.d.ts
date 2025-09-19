declare global {
  var __WS_CLIENTS: Set<WebSocket> | undefined;
}
export {};

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}/api/ws`);

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  // handle hello/state/broadcast/left/ping/pong
});

// send state updates
function sendState(x: number, y: number) {
  ws.send(JSON.stringify({ type: "state", x, y }));
}