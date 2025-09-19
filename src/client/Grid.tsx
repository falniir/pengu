import React, { useEffect, useMemo, useState, type JSX } from 'react';
import { useWS } from './ws';
import type { PlantType } from '../shared/protocol';

const VIEW_RADIUS = 25; // radius around player (results in 51x51)
const CELL_SIZE = 20;

const palette: Record<PlantType, string> = { seed: '#6b7280', flower: '#ef4444', tree: '#10b981' };
const icons: Record<PlantType, string> = { seed: '🌱', flower: '🌸', tree: '🌳' };

interface CellProps { x: number; y: number; plant?: { type: PlantType; owner: string; plantedAt: number }; isHome: boolean; isOwnedPlant: boolean; isPlayer: boolean; playersHere: string[]; onPrimary: () => void; showDots: boolean }

const Cell: React.FC<CellProps> = ({ x, y, plant, isHome, isOwnedPlant, isPlayer, playersHere, onPrimary, showDots }) => {
  const color = plant ? palette[plant.type] : 'transparent';
  const base = plant ? icons[plant.type] : (showDots ? '·' : '');
const isSoloOther = !isPlayer && playersHere.length === 1;
const showPlayerIcon = isPlayer || isSoloOther; // show single person when exactly one player (you or another)
const showGroup = playersHere.length > 1;       // 2+ players on the tile
  const homeTint = !plant && isHome ? 'rgba(56,189,248,0.08)' : undefined; // cyan-ish tint
  return (
    <div
      onClick={e => { e.preventDefault(); onPrimary(); }}
      title={`(${x},${y}) ${plant ? plant.type + ' by ' + plant.owner : 'empty'}${playersHere.length ? ' | players: ' + playersHere.join(',') : ''}`}
      style={{
        width: CELL_SIZE, height: CELL_SIZE, boxSizing: 'border-box', position: 'relative',
        fontSize: plant ? 14 : 10, lineHeight: CELL_SIZE + 'px', textAlign: 'center', cursor: 'pointer',
        background: plant ? color : homeTint || 'transparent',
        border: isHome ? '1px solid #334155' : '1px solid #1e293b',
        outline: isPlayer ? '2px solid #fef08a' : isOwnedPlant ? '2px solid rgba(255,255,255,0.4)' : 'none',
        boxShadow: isPlayer ? '0 0 4px 2px rgba(252,211,77,0.6)' : undefined,
        transition: 'background 120ms',
        userSelect: 'none'
      }}> 
      {base}
      {showGroup && (
        <span style={{
          position: 'absolute',
          left: 2,
          top: 2,
          fontSize: 12,
          lineHeight: CELL_SIZE + 'px',
          pointerEvents: 'none'
        }}>👥</span>
      )}
      {showPlayerIcon && (
        <span style={{
          position: 'absolute',
          right: 2,
          bottom: 2,
          fontSize: 12,
          lineHeight: CELL_SIZE + 'px',
          pointerEvents: 'none'
        }}>🧍</span>
      )}
    </div>
  );
};

export const Grid: React.FC = () => {
  const { tiles, plant, clear, home, playerId, players, myPos, move } = useWS() as any;
  const [selectedType, setSelectedType] = useState<PlantType>('seed');
  const [showDots, setShowDots] = useState(false);
  const [plantMode, setPlantMode] = useState<'plant' | 'clear'>('plant');

  // Movement via keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': move(0, -1); break;
        case 'ArrowDown': case 's': case 'S': move(0, 1); break;
        case 'ArrowLeft': case 'a': case 'A': move(-1, 0); break;
        case 'ArrowRight': case 'd': case 'D': move(1, 0); break;
        case '1': setSelectedType('seed'); break;
        case '2': setSelectedType('flower'); break;
        case '3': setSelectedType('tree'); break;
        case 'c': case 'C': setShowDots(v => !v); break;
        case 'm': case 'M': setPlantMode(m => m === 'plant' ? 'clear' : 'plant'); break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  const viewOrigin = useMemo(() => {
    if (!myPos) return { x: 0, y: 0 };
    return { x: myPos.x - VIEW_RADIUS, y: myPos.y - VIEW_RADIUS };
  }, [myPos]);

  const rows = useMemo(() => {
    const arr: JSX.Element[] = [];
    for (let y = viewOrigin.y; y <= viewOrigin.y + VIEW_RADIUS * 2; y++) {
      const row: JSX.Element[] = [];
      for (let x = viewOrigin.x; x <= viewOrigin.x + VIEW_RADIUS * 2; x++) {
        const k = `${x},${y}`;
        const plantData = tiles[k];
        const isHome = home ? (x >= home.x && y >= home.y && x < home.x + home.w && y < home.y + home.h) : false;
        const isPlayer = myPos && x === myPos.x && y === myPos.y;
        const isOwnedPlant = plantData?.owner === playerId;
        //include everyone, including self
         const playersHere = (Object.values(players) as any[])
           .filter((p: any) => p.x === x && p.y === y) // include everyone, even me
           .map((p: any) => p.id);
        row.push(<Cell key={k} x={x} y={y} plant={plantData} isHome={isHome} isOwnedPlant={isOwnedPlant} isPlayer={!!isPlayer} playersHere={playersHere} showDots={showDots} onPrimary={() => {
          if (plantMode === 'clear') {
            if (plantData && plantData.owner === playerId) clear(x, y);
          } else {
            if (!plantData) plant(x, y, selectedType);
          }
        }} />);
      }
      arr.push(<div key={y} style={{ display: 'flex' }}>{row}</div>);
    }
    return arr;
  }, [tiles, viewOrigin, home, myPos, playerId, players, showDots, selectedType, plantMode, plant, clear]);

  return (
    <div style={{ display: 'flex', gap: 24, padding: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 260 }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong>Player</strong>
          <div style={{ fontSize: 12 }}>You: {playerId} {myPos && `( ${myPos.x},${myPos.y} )`}</div>
          <div style={{ fontSize: 12 }}>Others: {Math.max(0, Object.keys(players).length - (playerId ? 1 : 0))}</div>
          {home && <div style={{ fontSize: 11 }}>Home: {home.x},{home.y}</div>}
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong>Plant Type</strong>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['seed','flower','tree'] as PlantType[]).map(t => (
              <button key={t} onClick={() => setSelectedType(t)} disabled={selectedType === t}>{icons[t]} {t}</button>
            ))}
          </div>
          <div style={{ marginTop: 4 }}>
            <label style={{ fontSize: 12 }}>
              Mode: <button onClick={() => setPlantMode(m => m === 'plant' ? 'clear' : 'plant')}>{plantMode === 'plant' ? 'Plant' : 'Clear'}</button>
              <span style={{ marginLeft: 6, fontSize: 10 }}>(Press M)</span>
            </label>
          </div>
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong>Options</strong>
          <label style={{ fontSize: 12 }}><input type="checkbox" checked={showDots} onChange={e => setShowDots(e.target.checked)} /> Show dots on empty</label>
        </section>
        <section style={{ fontSize: 11, lineHeight: 1.4 }}>
          <strong>Legend</strong>
          <div>🌱 Seed</div>
          <div>🌸 Flower</div>
          <div>🌳 Tree</div>
          <div style={{ marginTop: 4 }}><strong>Keys</strong></div>
          <div>WASD / Arrows: Move</div>
          <div>1/2/3: Plant type</div>
          <div>M: Toggle plant/clear</div>
          <div>C: Toggle dots</div>
        </section>
      </div>
      <div style={{ border: '1px solid #334155', background: '#0f172a', padding: 4, overflow: 'auto', maxHeight: CELL_SIZE * (VIEW_RADIUS * 2 + 1) + 8 }}>
        {rows}
      </div>
    </div>
  );
};
