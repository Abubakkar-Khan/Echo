import { create } from 'zustand';
import { 
  WORLD_WIDTH,
  WORLD_HEIGHT,
  GRID_SIZE,
  COLLISION_RADII, 
  SELF_COLLISION_GRACE_TICKS 
} from '../game/constants';
import { getRandomOrbPosition, getRandomSpawnPosition } from '../utils/gameUtils';
import { AudioSystem } from '../systems/AudioSystem';

export interface PathPoint {
  x: number;
  y: number;
  angle: number;
}

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

interface GameStoreState {
  gameState: GameState;
  score: number;
  bestScore: number;
  playerPosition: [number, number];
  playerAngle: number;
  currentTimeline: PathPoint[];
  pastTimelines: PathPoint[][];
  orbPosition: [number, number];
  tickCount: number;
  physicsAccumulator: number;
  newBestEarned: boolean;
  
  // Actions
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  collectOrb: () => void;
  resetGame: () => void;
  setAccumulator: (val: number) => void;
  incrementTick: (inputX: number, inputY: number) => void;
}

const getInitialBestScore = (): number => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('echo_2d_best_score');
    return saved ? parseInt(saved, 10) : 0;
  }
  return 0;
};

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: 'MENU',
  score: 0,
  bestScore: getInitialBestScore(),
  playerPosition: [WORLD_WIDTH / 2, WORLD_HEIGHT / 2],
  playerAngle: -Math.PI / 2, // facing up
  currentTimeline: [],
  pastTimelines: [],
  orbPosition: [WORLD_WIDTH / 2, WORLD_HEIGHT / 4],
  tickCount: 0,
  physicsAccumulator: 0,
  newBestEarned: false,

  startGame: () => {
    // Generate initial orb position first at the grid center
    const tempOrbPos: [number, number] = [
      Math.round((WORLD_WIDTH / 2) / GRID_SIZE) * GRID_SIZE,
      Math.round((WORLD_HEIGHT / 4) / GRID_SIZE) * GRID_SIZE
    ];
    // Spawns player at random grid coordinates away from orb
    const startPos = getRandomSpawnPosition(tempOrbPos);
    // Face random heading direction on start (grid-aligned: Up, Down, Left, or Right)
    const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    const startAngle = angles[Math.floor(Math.random() * angles.length)];
    // Generate actual first orb position away from player start pos
    const firstOrb = getRandomOrbPosition(startPos);
    
    AudioSystem.startDrone();
    
    set({
      gameState: 'PLAYING',
      score: 0,
      playerPosition: startPos,
      playerAngle: startAngle,
      currentTimeline: [{ x: startPos[0], y: startPos[1], angle: startAngle }],
      pastTimelines: [],
      orbPosition: firstOrb,
      tickCount: 0,
      physicsAccumulator: 0,
      newBestEarned: false,
    });
  },

  pauseGame: () => {
    const { gameState } = get();
    if (gameState === 'PLAYING') {
      AudioSystem.stopDrone();
      set({ gameState: 'PAUSED' });
    } else if (gameState === 'PAUSED') {
      AudioSystem.startDrone();
      set({ gameState: 'PLAYING' });
    }
  },

  resumeGame: () => {
    const { gameState } = get();
    if (gameState === 'PAUSED') {
      AudioSystem.startDrone();
      set({ gameState: 'PLAYING' });
    }
  },

  endGame: () => {
    const { score, bestScore } = get();
    AudioSystem.playImpact();
    AudioSystem.stopDrone();

    let newBest = false;
    let nextBest = bestScore;
    if (score > bestScore) {
      newBest = true;
      nextBest = score;
      if (typeof window !== 'undefined') {
        localStorage.setItem('echo_2d_best_score', score.toString());
      }
    }

    set({
      gameState: 'GAMEOVER',
      bestScore: nextBest,
      newBestEarned: newBest,
    });
  },

  collectOrb: () => {
    const { score, currentTimeline, pastTimelines, orbPosition } = get();
    AudioSystem.playChime();
    AudioSystem.playWhoosh();

    const nextScore = score + 1;
    const nextPastTimelines = [...pastTimelines, currentTimeline];
    
    // Spawn player at a new grid position away from the collected orb
    const startPos = getRandomSpawnPosition(orbPosition);
    // Face random heading direction
    const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    const startAngle = angles[Math.floor(Math.random() * angles.length)];
    // Spawn next orb away from this new player position
    const newOrb = getRandomOrbPosition(startPos);

    set({
      score: nextScore,
      pastTimelines: nextPastTimelines,
      currentTimeline: [{ x: startPos[0], y: startPos[1], angle: startAngle }],
      playerPosition: startPos,
      playerAngle: startAngle,
      tickCount: 0,
      orbPosition: newOrb,
      physicsAccumulator: 0,
    });
  },

  resetGame: () => {
    get().startGame();
  },

  setAccumulator: (val: number) => {
    set({ physicsAccumulator: val });
  },

  incrementTick: (inputX: number, inputY: number) => {
    const state = get();
    if (state.gameState !== 'PLAYING') return;

    let { playerPosition, playerAngle, currentTimeline, tickCount, pastTimelines, orbPosition } = state;
    let [x, y] = playerPosition;
    
    // 1. Update movement angle if keys are pressed (Strict instant turns, lock 180-degree turns)
    if (inputX !== 0 || inputY !== 0) {
      const targetAngle = Math.atan2(inputY, inputX);
      const cosDiff = Math.cos(targetAngle - playerAngle);
      // Only turn if it's not a 180-degree backtrack
      if (cosDiff > -0.9) {
        playerAngle = targetAngle;
      }
    }
    
    // Move forward exactly 1 grid step (GRID_SIZE)
    x += Math.round(Math.cos(playerAngle)) * GRID_SIZE;
    y += Math.round(Math.sin(playerAngle)) * GRID_SIZE;

    // Teleportation across walls (Screen wrapping, aligned to grid cells)
    if (x < 0) x = WORLD_WIDTH - GRID_SIZE;
    if (x >= WORLD_WIDTH) x = 0;
    if (y < 0) y = WORLD_HEIGHT - GRID_SIZE;
    if (y >= WORLD_HEIGHT) y = 0;

    const nextPosition: [number, number] = [x, y];
    const nextTimelinePoint = { x, y, angle: playerAngle };
    const nextTimeline = [...currentTimeline, nextTimelinePoint];
    const nextTickCount = tickCount + 1;

    // 2. Orb Collection Check (Exact grid coordinate matching)
    if (x === orbPosition[0] && y === orbPosition[1]) {
      state.collectOrb();
      return; // Exit early
    }

    // 3. Self-trail Collision (Exact grid coordinate matching, grace period for neck)
    if (nextTickCount > SELF_COLLISION_GRACE_TICKS) {
      const activeSelfTrail = nextTimeline.slice(0, -SELF_COLLISION_GRACE_TICKS);
      for (const pt of activeSelfTrail) {
        if (x === pt.x && y === pt.y) {
          state.endGame();
          return;
        }
      }
    }

    // 4. Replay trails collision
    // Skip checking collision against past timelines during the very beginning of a loop (first grace steps)
    // to allow the player and ghosts to disperse from spawn.
    if (nextTickCount > SELF_COLLISION_GRACE_TICKS) {
      for (let j = 0; j < pastTimelines.length; j++) {
        const timeline = pastTimelines[j];
        const L = timeline.length;
        if (L === 0) continue;
        
        const currentReplayIndex = Math.min(nextTickCount, L - 1);
        const limitIndex = Math.min(nextTickCount + 1, L);

        // Exclude the starting few recorded points of past runs to make the spawn area safe
        const startIndex = Math.min(SELF_COLLISION_GRACE_TICKS, L);
        for (let i = startIndex; i < limitIndex; i++) {
          const pt = timeline[i];
          if (x === pt.x && y === pt.y) {
            state.endGame();
            return;
          }
        }
      }
    }

    set({
      playerPosition: nextPosition,
      playerAngle,
      currentTimeline: nextTimeline,
      tickCount: nextTickCount,
    });
  }
}));
