import React, { useMemo } from 'react';
import { useWS } from './ws';

interface MinimapProps {
  width?: number; // pixel size square
}

const DEFAULT_SIZE = 180;

// Down-sample world to minimap; we just plot home rectangle & players.
export const Minimap: React.FC<MinimapProps> = ({ width = DEFAULT_SIZE }) => {
  const { worldSize, home, players, playerId, myPos } = useWS() as any;
  if (!worldSize) return null;

  const { w, h } = worldSize;
  const aspect = w / h;
  const mapW = width;
  const mapH = Math.round(width / aspect);

  const playerDots = useMemo(() => Object.values(players || {}), [players]);

  function worldToMini(x: number, y: number) {
    return { mx: (x / w) * mapW, my: (y / h) * mapH };
  }

  const homeRect = home ? (() => {
    const tl = worldToMini(home.x, home.y);
    const br = worldToMini(home.x + home.w, home.y + home.h);
    return { x: tl.mx, y: tl.my, w: Math.max(2, br.mx - tl.mx), h: Math.max(2, br.my - tl.my) };
  })() : undefined;

  const myDot = myPos ? worldToMini(myPos.x, myPos.y) : undefined;

  return (
    <div style={{ width: mapW, height: mapH, position: 'relative', background: '#0a0f17', border: '1px solid #1e293b', borderRadius: 4, overflow: 'hidden' }}>
      {homeRect && (
        <div style={{ position: 'absolute', left: homeRect.x, top: homeRect.y, width: homeRect.w, height: homeRect.h, background: 'rgba(56,189,248,0.25)', border: '1px solid #38bdf8' }} />
      )}
      {playerDots.map((p: any) => {
        const { mx, my } = worldToMini(p.x, p.y);
        const isMe = p.id === playerId;
        return <div key={p.id} style={{ position: 'absolute', left: mx - 2, top: my - 2, width: 4, height: 4, borderRadius: 2, background: isMe ? '#fef08a' : '#94a3b8', boxShadow: isMe ? '0 0 6px 2px rgba(254,240,138,0.7)' : undefined }} />;
      })}
      {myDot && (
        <div style={{ position: 'absolute', left: myDot.mx - 3, top: myDot.my - 3, width: 6, height: 6, borderRadius: 3, background: 'transparent', border: '1px solid #fef08a' }} />
      )}
    </div>
  );
};
