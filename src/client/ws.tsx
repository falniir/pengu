import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ClientToServer, DeltaTile, PlantType, ServerToClient, WelcomePayload, PlayerState } from '../shared/protocol';

interface TileData { type: PlantType; owner: string; plantedAt: number }
interface TilesMap { [key: string]: TileData }

interface WSContextValue {
  connected: boolean;
  playerId?: string;
  home?: { x: number; y: number; w: number; h: number };
  worldSize?: { w: number; h: number };
  tiles: TilesMap;
  players: Record<string, PlayerState>;
  myPos?: { x: number; y: number };
  move: (dx: number, dy: number) => void;
  plant: (x: number, y: number, plantType: PlantType) => void;
  clear: (x: number, y: number) => void;
}

const WSContext = createContext<WSContextValue | null>(null);

export const WSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | undefined>();
  const [home, setHome] = useState<WelcomePayload['home'] | undefined>();
  const [worldSize, setWorldSize] = useState<{ w: number; h: number } | undefined>();
  const [tiles, setTiles] = useState<TilesMap>({});
  const [players, setPlayers] = useState<Record<string, PlayerState>>({});
  const [myPos, setMyPos] = useState<{ x: number; y: number } | undefined>();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Use same-origin host & protocol; avoid changing when playerId updates
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = (ev) => {
      console.warn('WS closed', ev.code, ev.reason);
      setConnected(false);
    };
    ws.onerror = () => {};
    ws.onmessage = ev => {
      let msg: ServerToClient;
      try { msg = JSON.parse(ev.data); } catch { return; }
      switch (msg.type) {
        case 'welcome': {
          setPlayerId(msg.payload.playerId);
          setHome(msg.payload.home);
          setWorldSize(msg.payload.worldSize);
          // initial myPos will be set when players snapshot arrives
          break;
        }
        case 'fullState': {
          const map: TilesMap = {};
          for (const t of msg.payload.tiles) {
            const [x,y,type,owner,plantedAt] = t;
            map[`${x},${y}`] = { type, owner, plantedAt };
          }
          setTiles(map);
          break;
        }
        case 'delta': {
          setTiles(prev => {
            const copy = { ...prev };
            for (const t of msg.payload.tiles as DeltaTile[]) {
              const [x,y,type,owner,plantedAt] = t;
              const k = `${x},${y}`;
              if (type === null) delete copy[k];
              else if (owner && plantedAt) copy[k] = { type, owner, plantedAt };
            }
            return copy;
          });
          break;
        }
        case 'players': {
          const rec: Record<string, PlayerState> = {};
            for (const p of msg.payload.players) rec[p.id] = p;
            setPlayers(rec);
            if (playerId && rec[playerId]) {
              setMyPos({ x: rec[playerId].x, y: rec[playerId].y });
            }
          break;
        }
        case 'playerMove': {
          setPlayers(prev => {
            const updated = { ...prev };
            const existing = updated[msg.payload.id];
            if (existing) {
              updated[msg.payload.id] = { ...existing, x: msg.payload.x, y: msg.payload.y };
            } else {
              updated[msg.payload.id] = { id: msg.payload.id, x: msg.payload.x, y: msg.payload.y, home: { x: msg.payload.x, y: msg.payload.y, w: 0, h: 0 } } as any;
            }
            return updated;
          });
          if (msg.payload.id === playerId) setMyPos({ x: msg.payload.x, y: msg.payload.y });
          break;
        }
      }
    };

    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', payload: { t: Date.now() } }));
      }
    }, 20000);
    return () => { clearInterval(interval); ws.close(); };
  }, []); // mount once

  function send(msg: ClientToServer) {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  const value: WSContextValue = {
    connected, playerId, home, worldSize, tiles, players, myPos,
    move: (dx, dy) => send({ type: 'move', payload: { dx, dy } }),
    plant: (x, y, plantType) => send({ type: 'plant', payload: { x, y, plantType } }),
    clear: (x, y) => send({ type: 'clear', payload: { x, y } }),
  };

  return <WSContext.Provider value={value}>{children}</WSContext.Provider>;
};

export function useWS() {
  const ctx = useContext(WSContext);
  if (!ctx) throw new Error('useWS must be inside provider');
  return ctx;
}
