#!/usr/bin/env bun

type Sub = ReturnType<typeof Bun.spawn>;
const procs: Sub[] = [];
const td = new TextDecoder();

async function pipe(name: string, stream: ReadableStream<Uint8Array> | null, out: any) {
  if (!stream) return;
  const reader = stream.getReader();
  const prefix = `[${name}] `;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) out.write(prefix + td.decode(value));
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

function spawnProc(name: string, cmd: string[], env: Record<string, string> = {}) {
  const p = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });
  procs.push(p);
  pipe(name, p.stdout, process.stdout).catch(() => {});
  pipe(name, p.stderr, process.stderr).catch(() => {});
  return p;
}

const web = spawnProc("web", ["bun", "run", "dev:web"], { NEXT_DISABLE_AUTO_INSTALL: "1" });
const ws = spawnProc("ws", ["bun", "run", "dev:ws"], { WS_PORT: process.env.WS_PORT ?? "3001" });

async function shutdown(code = 0) {
  for (const p of procs) {
    try { p.kill(); } catch {}
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

Promise.all([web.exited, ws.exited]).then(([a, b]) => shutdown(a || b));