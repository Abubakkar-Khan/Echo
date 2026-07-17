import React, { useEffect } from 'react';
import { Play, RotateCcw, AlertTriangle, Info, Pause } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useGameStore } from '../store/useGameStore';
import { RoughBorder } from './RoughBorder';
import { AudioSystem } from '../systems/AudioSystem';

export function HUD() {
  const {
    gameState,
    score,
    bestScore,
    newBestEarned,
    startGame,
    pauseGame,
    resetGame,
    hasShield,
    slowMoTimeLeft,
  } = useGameStore();

  // Unlock browser audio context on first click or keypress
  useEffect(() => {
    const handleGesture = () => {
      AudioSystem.unlock();
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, []);

  // Listen to keyboard commands for game states (ESC, R, Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyR' || e.code === 'Escape') {
        e.preventDefault();
      }

      if (e.code === 'Space') {
        if (gameState === 'MENU') {
          startGame();
        } else if (gameState === 'GAMEOVER') {
          startGame();
        } else if (gameState === 'PAUSED') {
          pauseGame();
        }
      }

      if (e.code === 'Escape') {
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
          pauseGame();
        }
      }

      if (e.code === 'KeyR') {
        if (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAMEOVER') {
          resetGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, startGame, pauseGame, resetGame]);

  // Trigger confetti burst on new best score
  useEffect(() => {
    if (gameState === 'GAMEOVER' && newBestEarned) {
      const duration = 1.5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 25, spread: 360, ticks: 50, zIndex: 100 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 40 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [gameState, newBestEarned]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-8 text-[#2d2a29] font-sans">
      
      {/* 1. TOP BAR: Score Indicators (Visible during PLAYING / PAUSED) */}
      <div className="flex justify-between items-start w-full">
        {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
          <RoughBorder fill="#ffffff" stroke="#2d2a29" strokeWidth={1.8} className="px-5 py-3 pointer-events-auto">
            <div className="flex gap-6 items-center text-[#2d2a29]">
              <div>
                <p className="text-[11px] tracking-widest text-neutral-500 font-bold uppercase">Loops</p>
                <p className="text-3xl font-black text-[#00b4d8] leading-tight">{score}</p>
              </div>
              <div className="w-[1.5px] bg-[#2d2a29]/15 h-8 self-center" />
              <div>
                <p className="text-[11px] tracking-widest text-neutral-500 font-bold uppercase">Best</p>
                <p className="text-3xl font-black leading-tight">{bestScore}</p>
              </div>
            </div>
          </RoughBorder>
        )}
        
        {/* Active Powerups Badges */}
        {(gameState === 'PLAYING' || gameState === 'PAUSED') && (hasShield || slowMoTimeLeft > 0) && (
          <div className="flex gap-3 items-center pointer-events-auto absolute left-1/2 -translate-x-1/2 top-8">
            {hasShield && (
              <RoughBorder fill="#e0f2fe" stroke="#00b4d8" strokeWidth={1.5} className="px-3.5 py-1.5 flex items-center gap-1.5 text-sky-700">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                <span className="text-[10px] tracking-widest font-extrabold uppercase">SHIELD ACTIVE</span>
              </RoughBorder>
            )}
            {slowMoTimeLeft > 0 && (
              <RoughBorder fill="#f3e8ff" stroke="#7209b7" strokeWidth={1.5} className="px-3.5 py-1.5 flex items-center gap-1.5 text-purple-700">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-[10px] tracking-widest font-extrabold uppercase font-sans">
                  SLOW MO: {(slowMoTimeLeft / 60).toFixed(1)}s
                </span>
              </RoughBorder>
            )}
          </div>
        )}
        
        {/* Pause Badge */}
        {gameState === 'PAUSED' && (
          <RoughBorder fill="#fffbeb" stroke="#d97706" strokeWidth={1.5} className="px-4 py-1.5 pointer-events-auto">
            <div className="flex items-center gap-1.5 text-amber-700">
              <Pause size={12} className="fill-amber-700" />
              <span className="text-[11px] tracking-widest font-extrabold uppercase">PAUSED</span>
            </div>
          </RoughBorder>
        )}
      </div>

      {/* 2. CENTER OVERLAYS: Menu, Paused, Game Over */}
      <div className="flex-1 flex items-center justify-center pointer-events-auto">
        
        {/* MAIN START MENU */}
        {gameState === 'MENU' && (
          <RoughBorder fill="#fdfcf7" stroke="#2d2a29" strokeWidth={2.5} className="max-w-md w-full p-8 shadow-md">
            <div className="text-center flex flex-col items-center gap-5">
              <div>
                <h1 className="text-5xl font-black tracking-widest text-[#00b4d8] py-1 select-none">
                  ECHO
                </h1>
                <p className="text-[11px] text-neutral-500 tracking-[0.25em] font-bold uppercase">
                  Every loop leaves a memory.
                </p>
                <p className="text-[10px] text-[#2d2a29] font-bold tracking-widest uppercase mt-0.5 select-none bg-yellow-100/50 border border-dashed border-[#2d2a29]/15 px-2 py-0.5 rounded w-fit mx-auto">
                  Made by The Father of Initiative
                </p>
                {/* Sketchy line separator */}
                <div className="text-neutral-300 font-bold text-lg select-none leading-none mt-1">
                  ~~~~~~~~~~~~~~
                </div>
              </div>

              <p className="text-sm text-neutral-650 leading-relaxed font-medium px-2">
                Collect golden stars to trigger rewinds. Your past timelines slither alongside you in solid, vibrant colors!
                <br />
                <span className="text-[#0077b6] font-semibold">★ Softbody Physics:</span> Bends and curves organically.
                <br />
                <span className="text-emerald-600 font-semibold">★ Upgrades Spawning:</span> Collect **Shield** 🛡️, **Slow-Mo Clock** ⏱️, and **Ghost Eraser** 🧼 to wipe clutter. Wrapping across walls teleports you!
              </p>

              <button
                onClick={startGame}
                className="w-full max-w-[240px] focus:outline-none transition-transform duration-150 active:scale-98"
              >
                <RoughBorder 
                  fill="#b5e2fa" // soft blue sketch fill
                  fillStyle="hachure"
                  hachureGap={5}
                  stroke="#2d2a29" 
                  strokeWidth={2} 
                  className="py-3 font-extrabold text-sm tracking-widest uppercase hover:scale-102 transition-all flex items-center justify-center gap-2 text-[#2d2a29]"
                >
                  <Play size={12} className="fill-[#2d2a29]" />
                  Start Loop
                </RoughBorder>
              </button>

              {/* Sketch controls card */}
              <div className="w-full border-t border-[#2d2a29]/10 pt-4 text-left grid grid-cols-2 gap-4 text-[11px] text-neutral-500 tracking-wider">
                <div className="flex gap-2">
                  <span className="text-[#0077b6] font-bold bg-[#e0f2fe] border border-[#7dd3fc] px-1.5 py-0.5 rounded h-fit">WASD</span>
                  <span>Strict movement. Turn instantly without curve delay.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded h-fit">ESC</span>
                  <span>Pause loop. Press <span className="font-bold">R</span> to quick restart at any time.</span>
                </div>
              </div>
            </div>
          </RoughBorder>
        )}

        {/* PAUSE OVERLAY */}
        {gameState === 'PAUSED' && (
          <RoughBorder fill="#fffbeb" stroke="#d97706" strokeWidth={2.2} className="max-w-xs w-full p-8 shadow-md">
            <div className="text-center flex flex-col items-center gap-5">
              <h2 className="text-2xl font-black tracking-widest text-amber-700 uppercase">Loop Paused</h2>
              
              <div className="flex flex-col gap-3.5 w-full">
                <button
                  onClick={pauseGame}
                  className="w-full focus:outline-none active:scale-98"
                >
                  <RoughBorder 
                    fill="#fef3c7"
                    fillStyle="solid"
                    stroke="#d97706"
                    strokeWidth={1.8}
                    className="py-2.5 font-extrabold tracking-widest text-xs uppercase text-amber-800"
                  >
                    Resume Game
                  </RoughBorder>
                </button>
                <button
                  onClick={resetGame}
                  className="w-full focus:outline-none active:scale-98"
                >
                  <RoughBorder 
                    fill="#fefaf0"
                    fillStyle="hachure"
                    stroke="#2d2a29"
                    strokeWidth={1.5}
                    className="py-2.5 font-extrabold tracking-widest text-xs uppercase flex items-center justify-center gap-2 text-neutral-700"
                  >
                    <RotateCcw size={11} />
                    Reset Level
                  </RoughBorder>
                </button>
              </div>
            </div>
          </RoughBorder>
        )}

        {/* GAME OVER OVERLAY */}
        {gameState === 'GAMEOVER' && (
          <RoughBorder fill="#fff5f5" stroke="#dc2626" strokeWidth={2.5} className="max-w-sm w-full p-8 shadow-md">
            <div className="text-center flex flex-col items-center gap-5">
              <div className="flex flex-col items-center gap-1">
                <AlertTriangle className="text-red-600 animate-bounce" size={28} />
                <h2 className="text-3xl font-black tracking-widest text-red-600 uppercase leading-none">COLLISION!</h2>
                <p className="text-[10px] text-neutral-500 tracking-widest uppercase font-bold">Timeline collapsed</p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full bg-white/60 border border-[#2d2a29]/10 rounded-2xl p-4 my-1">
                <div>
                  <p className="text-[10px] tracking-widest text-neutral-500 uppercase font-bold mb-0.5">Final Loops</p>
                  <p className="text-4xl font-black tracking-tight text-neutral-800 leading-none">{score}</p>
                </div>
                <div>
                  <p className="text-[10px] tracking-widest text-neutral-500 uppercase font-bold mb-0.5">Best Score</p>
                  <p className={`text-4xl font-black tracking-tight leading-none ${newBestEarned ? 'text-emerald-600' : 'text-neutral-800'}`}>
                    {bestScore}
                  </p>
                </div>
              </div>

              {newBestEarned && (
                <RoughBorder 
                  fill="#ecfdf5" 
                  fillStyle="zigzag" 
                  hachureGap={4}
                  stroke="#10b981" 
                  strokeWidth={1.5} 
                  className="py-2 w-full text-xs text-emerald-700 font-extrabold tracking-widest uppercase text-center animate-pulse"
                >
                  ★ New Sketch Record! ★
                </RoughBorder>
              )}

              <div className="flex flex-col gap-3.5 w-full">
                <button
                  onClick={startGame}
                  className="w-full focus:outline-none active:scale-98"
                >
                  <RoughBorder
                    fill="#ffd166"
                    fillStyle="hachure"
                    hachureGap={5}
                    stroke="#2d2a29"
                    strokeWidth={2}
                    className="py-3 font-extrabold text-sm tracking-widest uppercase text-[#2d2a29]"
                  >
                    Try Next Loop
                  </RoughBorder>
                </button>
                <p className="text-[10px] text-neutral-500 tracking-wider">
                  Press <span className="text-neutral-600 font-bold bg-[#eae6da] px-1 border border-neutral-300 rounded">SPACE</span> to trigger instant reset
                </p>
              </div>
            </div>
          </RoughBorder>
        )}
      </div>

      {/* 3. BOTTOM BAR: Instructions (Visible during PLAYING) */}
      <div className="w-full flex justify-center text-center">
        {gameState === 'PLAYING' && (
          <RoughBorder fill="#ffffff" stroke="#2d2a29" strokeWidth={1.5} className="px-6 py-2 pointer-events-auto">
            <div className="flex items-center gap-1.5 text-neutral-600">
              <Info size={11} className="text-[#00b4d8] animate-pulse" />
              <p className="text-[10px] tracking-[0.2em] font-bold uppercase">
                Grab Orb <span className="text-neutral-300 mx-1">•</span> Dodging past loop snakes
              </p>
            </div>
          </RoughBorder>
        )}
      </div>

    </div>
  );
}
export default HUD;
