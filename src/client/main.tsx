import React from 'react';
import { createRoot } from 'react-dom/client';
import { WSProvider, useWS } from './ws';
import { Grid } from './Grid';
import { Minimap } from './Minimap';

const App: React.FC = () => {
  const { connected, playerId } = useWS();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ padding: 8, background: '#1e293b', display: 'flex', gap: 16 }}>
        <h1 style={{ fontSize: 16, margin: 0 }}>Garden Prototype</h1>
        <div style={{ fontSize: 12 }}>{connected ? 'Connected' : 'Disconnected'} {playerId && `as ${playerId}`}</div>
        <Minimap/>
      </header>
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Grid />
      </main>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <WSProvider>
    <App />
  </WSProvider>
);
