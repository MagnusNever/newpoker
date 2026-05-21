import { useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { Lobby } from './components/Lobby';
import { PokerTable } from './components/PokerTable';
import './App.css';

function GameShell() {
  const { phase, errorMessage, clearError } = useGame();

  useEffect(() => {
    if (!errorMessage) return;
    const timer = window.setTimeout(clearError, 3500);
    return () => window.clearTimeout(timer);
  }, [clearError, errorMessage]);

  return (
    <main className="app-shell">
      {errorMessage && (
        <button className="toast" onClick={clearError}>
          {errorMessage}
        </button>
      )}
      {phase === 'lobby' || phase === 'waiting' ? <Lobby /> : <PokerTable />}
    </main>
  );
}

export default function App() {
  return (
    <GameProvider>
      <GameShell />
    </GameProvider>
  );
}
