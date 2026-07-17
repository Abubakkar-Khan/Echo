import { create } from 'zustand';
import { 
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PLAYER_SPEED, 
  SEGMENT_SPACING, 
  COLLISION_RADII, 
  SELF_COLLISION_GRACE_SEGMENTS 
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
  
  // Upgrade Powerup states
  numSegments: number;
  hasShield: boolean;
  slowMoTimeLeft: number;
  immunityTicks: number;
  powerupPosition: [number, number] | null;
  powerupType: 'SHIELD' | 'SLOWMO' | 'ERASER' | null;
  ghostReplayTicks: number[];
  
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

  // Upgrades
  numSegments: 12,
  hasShield: false,
  slowMoTimeLeft: 0,
  immunityTicks: 0,
  powerupPosition: null,
  powerupType: null,
  ghostReplayTicks: [],

  startGame: () => {
    // Generate initial orb position first at the grid center
    const tempOrbPos: [number, number] = [WORLD_WIDTH / 2, WORLD_HEIGHT / 4];
    // Spawns player at random grid coordinates away from orb
    const startPos = getRandomSpawnPosition(tempOrbPos);
    // Face random heading direction on start
    const startAngle = Math.random() * Math.PI * 2;
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
      numSegments: 12,
      hasShield: false,
      slowMoTimeLeft: 0,
      immunityTicks: 0,
      powerupPosition: null,
      powerupType: null,
      ghostReplayTicks: [],
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
    const { score, currentTimeline, pastTimelines, orbPosition, numSegments, ghostReplayTicks } = get();
    AudioSystem.playChime();
    AudioSystem.playWhoosh();

    const nextScore = score + 1;
    const nextPastTimelines = [...pastTimelines, currentTimeline];
    
    // Spawn player at a new position away from the collected orb
    const startPos = getRandomSpawnPosition(orbPosition);
    // Face random heading direction
    const startAngle = Math.random() * Math.PI * 2;
    // Spawn next orb away from this new player position
    const newOrb = getRandomOrbPosition(startPos);

    // Grow player segments (Softbody size)
    const nextSegments = numSegments + 6;

    // Upgrades spawn chance (35%)
    let nextPowerupPos: [number, number] | null = null;
    let nextPowerupType: 'SHIELD' | 'SLOWMO' | 'ERASER' | null = null;
    if (Math.random() < 0.35) {
      nextPowerupPos = getRandomOrbPosition(startPos);
      const types: ('SHIELD' | 'SLOWMO' | 'ERASER')[] = ['SHIELD', 'SLOWMO', 'ERASER'];
      nextPowerupType = types[Math.floor(Math.random() * types.length)];
    }

    // Set initial playback index for the newly added ghost
    const nextGhostTicks = [...ghostReplayTicks.map(() => 0), 0]; // reset all ghost positions to 0 at loop reset!
    
    set({
      score: nextScore,
      pastTimelines: nextPastTimelines,
      currentTimeline: [{ x: startPos[0], y: startPos[1], angle: startAngle }],
      playerPosition: startPos,
      playerAngle: startAngle,
      tickCount: 0,
      orbPosition: newOrb,
      physicsAccumulator: 0,
      numSegments: nextSegments,
      powerupPosition: nextPowerupPos,
      powerupType: nextPowerupType,
      ghostReplayTicks: nextGhostTicks,
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

    let { 
      playerPosition, 
      playerAngle, 
      currentTimeline, 
      tickCount, 
      pastTimelines, 
      orbPosition,
      numSegments,
      hasShield,
      slowMoTimeLeft,
      immunityTicks,
      powerupPosition,
      powerupType,
      ghostReplayTicks
    } = state;
    
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
    
    // Timed active counters
    if (slowMoTimeLeft > 0) slowMoTimeLeft -= 1;
    if (immunityTicks > 0) immunityTicks -= 1;

    // Continuous forward speed movement (increases as score increases!)
    const currentSpeed = PLAYER_SPEED + state.score * 12;
    
    // Move forward 1 physics tick (running at 60Hz)
    x += Math.cos(playerAngle) * currentSpeed * (1 / 60);
    y += Math.sin(playerAngle) * currentSpeed * (1 / 60);

    // Teleportation across walls (Screen wrapping)
    if (x < 0) x += WORLD_WIDTH;
    if (x >= WORLD_WIDTH) x -= WORLD_WIDTH;
    if (y < 0) y += WORLD_HEIGHT;
    if (y >= WORLD_HEIGHT) y -= WORLD_HEIGHT;

    const nextPosition: [number, number] = [x, y];
    const nextTimelinePoint = { x, y, angle: playerAngle };
    const nextTimeline = [...currentTimeline, nextTimelinePoint];
    const nextTickCount = tickCount + 1;

    // 2. Collectible Powerup Check
    if (powerupPosition !== null && powerupType !== null) {
      const dxPower = x - powerupPosition[0];
      const dyPower = y - powerupPosition[1];
      const distPower = Math.sqrt(dxPower * dxPower + dyPower * dyPower);

      if (distPower < (COLLISION_RADII.player + COLLISION_RADII.powerup)) {
        if (powerupType === 'SHIELD') {
          hasShield = true;
          AudioSystem.playShieldCollect();
        } else if (powerupType === 'SLOWMO') {
          slowMoTimeLeft = 360; // 6 seconds of slow motion
          AudioSystem.playSlowMo();
        } else if (powerupType === 'ERASER') {
          // Erase the oldest past timeline to clear clutter
          if (pastTimelines.length > 0) {
            pastTimelines.shift();
            ghostReplayTicks.shift();
          }
          AudioSystem.playEraser();
        }
        powerupPosition = null;
        powerupType = null;
      }
    }

    // 3. Orb Collection Check
    const dxOrb = x - orbPosition[0];
    const dyOrb = y - orbPosition[1];
    const distOrb = Math.sqrt(dxOrb * dxOrb + dyOrb * dyOrb);
    if (distOrb < (COLLISION_RADII.player + COLLISION_RADII.orb)) {
      state.collectOrb();
      return; // Exit early
    }

    // Index lookback step for softbody segment coordinates along the head's history buffer
    const historyStep = Math.max(1, Math.round(SEGMENT_SPACING / (currentSpeed / 60)));

    // 4. Self-trail Collision (Verlet Softbody segment check using toroidal wrapping distance)
    const L_curr = nextTimeline.length;
    if (L_curr > SELF_COLLISION_GRACE_SEGMENTS * historyStep) {
      // Check collision against player body segments (excluding neck segments)
      for (let k = SELF_COLLISION_GRACE_SEGMENTS; k < numSegments; k++) {
        const idx = L_curr - 1 - k * historyStep;
        if (idx < 0) break; // tail hasn't slithered out yet

        const pt = nextTimeline[idx];
        let dx = Math.abs(x - pt.x);
        let dy = Math.abs(y - pt.y);
        // Wrap adjustment
        if (dx > WORLD_WIDTH / 2) dx = WORLD_WIDTH - dx;
        if (dy > WORLD_HEIGHT / 2) dy = WORLD_HEIGHT - dy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < (COLLISION_RADII.player + COLLISION_RADII.trail)) {
          if (hasShield && immunityTicks === 0) {
            hasShield = false;
            immunityTicks = 60; // 1 second of immunity
            AudioSystem.playShieldBreak();
          } else if (immunityTicks === 0) {
            state.endGame();
            return;
          }
        }
      }
    }

    // 5. Replay Trails Collision (Solid colored ghosts checks)
    const nextGhostReplayTicks = ghostReplayTicks.map((val, idx_g) => {
      const L_ghost = pastTimelines[idx_g].length;
      if (val >= L_ghost - 1) return L_ghost - 1; // frozen at end
      // Slow motion clock halves playback speeds of ghosts
      const speedScale = slowMoTimeLeft > 0 ? 0.5 : 1.0;
      return val + speedScale;
    });

    // Check collision against past timelines' body segments
    for (let j = 0; j < pastTimelines.length; j++) {
      const timeline = pastTimelines[j];
      const L = timeline.length;
      if (L === 0) continue;

      const ghTick = Math.round(nextGhostReplayTicks[j]);
      
      // Determine how many segments the ghost has (ghosts have a static segment length corresponding to their own run)
      // Since it grew by +6 per orb, ghost j has (12 + j * 6) segments
      const ghostSegments = 12 + j * 6;

      // Exclude starting segments near spawn point
      for (let k = 0; k < ghostSegments; k++) {
        const idx = ghTick - k * historyStep;
        if (idx < 0) break;

        const pt = timeline[idx];
        let dx = Math.abs(x - pt.x);
        let dy = Math.abs(y - pt.y);
        if (dx > WORLD_WIDTH / 2) dx = WORLD_WIDTH - dx;
        if (dy > WORLD_HEIGHT / 2) dy = WORLD_HEIGHT - dy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < (COLLISION_RADII.player + COLLISION_RADII.trail)) {
          if (hasShield && immunityTicks === 0) {
            hasShield = false;
            immunityTicks = 60;
            AudioSystem.playShieldBreak();
          } else if (immunityTicks === 0) {
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
      hasShield,
      slowMoTimeLeft,
      immunityTicks,
      powerupPosition,
      powerupType,
      ghostReplayTicks: nextGhostReplayTicks,
    });
  }
}));
