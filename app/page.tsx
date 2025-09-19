export default function Home() {
  const wsUrl =
    typeof window !== "undefined"
      ? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`
      : "/api/ws";

  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ color: "#11133C" }}>Pengu</h1>
      <p style={{ color: "#11133C" }}>Multiplayer penguin. Connects to Edge WS at /api/ws.</p>
      <pre style={{ background: "#F9EAD4", padding: 12, borderRadius: 8 }}>
        WS: {wsUrl}
      </pre>
    </main>
  );
}