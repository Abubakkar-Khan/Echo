import React, { useEffect, useRef } from 'react';
import rough from 'roughjs';
import { useGameStore } from '../store/useGameStore';
import { useInput } from '../hooks/useInput';
import { WORLD_WIDTH, WORLD_HEIGHT, GRID_SIZE, COLLISION_RADII } from '../game/constants';

// Helper to convert hex strings to rgba format to support fading opacities
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Sketched pastel color palette for past loop ghosts
const GHOST_PALETTE = [
  { stroke: '#e63946', fill: '#ffadad' }, // Soft pinkish-red
  { stroke: '#1b9aaa', fill: '#b5f2ea' }, // Mint teal
  { stroke: '#f77f00', fill: '#ffd6a5' }, // Peach orange
  { stroke: '#7209b7', fill: '#dec0f1' }, // Lavender violet
  { stroke: '#0077b6', fill: '#b5e2fa' }, // Pastel sky blue
  { stroke: '#b5179e', fill: '#ffc6ff' }, // Lilac magenta
  { stroke: '#ffd166', fill: '#fdfd96' }, // Muted gold yellow
];

export function GameCanvas2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const {
    gameState,
    playerPosition,
    playerAngle,
    currentTimeline,
    pastTimelines,
    orbPosition,
    tickCount,
    physicsAccumulator,
    incrementTick,
    setAccumulator,
    score,
  } = useGameStore();

  const inputRef = useInput();
  const animationFrameId = useRef<number>(0);
  const lastTime = useRef<number>(0);

  // Main game loop driving grid steps
  useEffect(() => {
    const loop = (time: number) => {
      if (lastTime.current === 0) {
        lastTime.current = time;
      }
      const delta = (time - lastTime.current) / 1000;
      lastTime.current = time;

      if (gameState === 'PLAYING') {
        const clampedDelta = Math.min(delta, 0.1);
        let acc = physicsAccumulator + clampedDelta;
        
        // Grid steps per second scales up with score/difficulty
        const fps = 8.0 + score * 0.85;
        const step = 1 / fps;

        while (acc >= step) {
          incrementTick(inputRef.current.x, inputRef.current.z);
          acc -= step;
        }
        setAccumulator(acc);
      }

      draw();
      animationFrameId.current = requestAnimationFrame(loop);
    };

    lastTime.current = 0;
    animationFrameId.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameState, physicsAccumulator, incrementTick, setAccumulator, score]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Clear background and draw notebook paper lines
    ctx.fillStyle = '#f7f4ea';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Blue graph-paper grid grids (aligned with grid cells)
    ctx.strokeStyle = 'rgba(78, 122, 199, 0.13)';
    ctx.lineWidth = 1;
    for (let x = 0; x < WORLD_WIDTH; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < WORLD_HEIGHT; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_WIDTH, y);
      ctx.stroke();
    }

    // Initialize Rough Canvas
    const rc = rough.canvas(canvas);

    // 2. Draw Static Sketched Arena Box
    ctx.strokeStyle = '#4a433f';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'miter';
    ctx.strokeRect(8, 8, WORLD_WIDTH - 16, WORLD_HEIGHT - 16);
    
    // Thin inner boundary
    ctx.strokeStyle = 'rgba(74, 67, 63, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(12, 12, WORLD_WIDTH - 24, WORLD_HEIGHT - 24);

    const N = pastTimelines.length;
    const time = Date.now() / 1000;

    // 3. Calculate fluid interpolation factor t
    const fps = 8.0 + score * 0.85;
    const step = 1 / fps;
    const t = Math.min(Math.max(physicsAccumulator / step, 0.0), 1.0);

    // Draw Past Replay Trails (Sketched Dashed Line + Blocky Segments)
    pastTimelines.forEach((timeline, j) => {
      const L = timeline.length;
      if (L === 0) return;

      const currentReplayIndex = Math.min(tickCount, L - 1);
      const prevReplayIndex = Math.max(0, currentReplayIndex - 1);
      const limitIndex = Math.min(tickCount + 1, L);

      const ghostColor = GHOST_PALETTE[j % GHOST_PALETTE.length];
      const ageRatio = N > 1 ? j / (N - 1) : 1;
      const opacity = 0.22 + ageRatio * 0.43; // ghost opacity (ranges 0.22 to 0.65)

      // A) Draw thin dashed connector line with interpolated wrap-checked segments
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < limitIndex; i++) {
        const curr = timeline[i];
        const prev = timeline[Math.max(0, i - 1)];
        let rx = curr.x;
        let ry = curr.y;

        // Apply interpolation only if the replay is moving and didn't just wrap
        if (tickCount < L && Math.abs(curr.x - prev.x) < WORLD_WIDTH / 2 && Math.abs(curr.y - prev.y) < WORLD_HEIGHT / 2) {
          rx = prev.x + (curr.x - prev.x) * t;
          ry = prev.y + (curr.y - prev.y) * t;
        }

        if (first) {
          ctx.moveTo(rx, ry);
          first = false;
        } else {
          const prevPt = timeline[i - 1];
          if (Math.abs(curr.x - prevPt.x) > WORLD_WIDTH / 2 || Math.abs(curr.y - prevPt.y) > WORLD_HEIGHT / 2) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(rx, ry);
          } else {
            ctx.lineTo(rx, ry);
          }
        }
      }
      ctx.save();
      ctx.strokeStyle = hexToRgba(ghostColor.stroke, opacity * 0.35);
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      // B) Draw Ghost body blocks with fluid interpolation
      for (let i = 0; i < limitIndex; i++) {
        const curr = timeline[i];
        const prev = timeline[Math.max(0, i - 1)];
        let rx = curr.x;
        let ry = curr.y;

        if (tickCount < L && Math.abs(curr.x - prev.x) < WORLD_WIDTH / 2 && Math.abs(curr.y - prev.y) < WORLD_HEIGHT / 2) {
          rx = prev.x + (curr.x - prev.x) * t;
          ry = prev.y + (curr.y - prev.y) * t;
        }

        const progress = i / L;
        const s = 10 + progress * 7;
        
        const fillRgba = hexToRgba(ghostColor.fill, opacity * 0.5);
        const strokeRgba = hexToRgba(ghostColor.stroke, opacity * 0.8);

        rc.rectangle(rx - s / 2, ry - s / 2, s, s, {
          fill: fillRgba,
          fillStyle: 'solid',
          stroke: strokeRgba,
          strokeWidth: 1.0,
          roughness: 0.8,
          bowing: 0.6,
        });
      }

      // C) Draw Replay Ghost Head (interpolated cute face)
      const head = timeline[currentReplayIndex];
      const prevHead = timeline[prevReplayIndex];
      let ghx = head.x;
      let ghy = head.y;

      if (tickCount < L && Math.abs(head.x - prevHead.x) < WORLD_WIDTH / 2 && Math.abs(head.y - prevHead.y) < WORLD_HEIGHT / 2) {
        ghx = prevHead.x + (head.x - prevHead.x) * t;
        ghy = prevHead.y + (head.y - prevHead.y) * t;
      }

      rc.rectangle(ghx - GRID_SIZE / 2, ghy - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE, {
        fill: hexToRgba(ghostColor.fill, opacity),
        stroke: hexToRgba(ghostColor.stroke, opacity * 1.2),
        strokeWidth: 1.8,
        roughness: 0.9,
        bowing: 0.8,
      });

      // Draw cute eyes on ghost head facing its direction
      const angle = head.angle;
      const leftEyeX = ghx + Math.cos(angle) * 5.0 - Math.sin(angle) * 4.5;
      const leftEyeY = ghy + Math.sin(angle) * 5.0 + Math.cos(angle) * 4.5;
      const rightEyeX = ghx + Math.cos(angle) * 5.0 + Math.sin(angle) * 4.5;
      const rightEyeY = ghy + Math.sin(angle) * 5.0 - Math.cos(angle) * 4.5;

      rc.circle(leftEyeX, leftEyeY, 5.5, {
        fill: hexToRgba('#ffffff', opacity),
        stroke: hexToRgba('#000000', opacity),
        strokeWidth: 1.0,
        roughness: 0.5,
      });
      rc.circle(rightEyeX, rightEyeY, 5.5, {
        fill: hexToRgba('#ffffff', opacity),
        stroke: hexToRgba('#000000', opacity),
        strokeWidth: 1.0,
        roughness: 0.5,
      });

      ctx.fillStyle = hexToRgba('#000000', opacity);
      ctx.beginPath();
      ctx.arc(leftEyeX + 0.5 * Math.cos(angle), leftEyeY + 0.5 * Math.sin(angle), 1.2, 0, Math.PI * 2);
      ctx.arc(rightEyeX + 0.5 * Math.cos(angle), rightEyeY + 0.5 * Math.sin(angle), 1.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Draw Player Trail & Body Blocks (Tapering, sliding organic squares)
    const totalPts = currentTimeline.length;
    if (totalPts >= 2) {
      // A) Draw thin connector line with interpolated wrap checks
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < totalPts; i++) {
        const curr = currentTimeline[i];
        const prev = currentTimeline[Math.max(0, i - 1)];
        let rx = curr.x;
        let ry = curr.y;

        if (Math.abs(curr.x - prev.x) < WORLD_WIDTH / 2 && Math.abs(curr.y - prev.y) < WORLD_HEIGHT / 2) {
          rx = prev.x + (curr.x - prev.x) * t;
          ry = prev.y + (curr.y - prev.y) * t;
        }

        if (first) {
          ctx.moveTo(rx, ry);
          first = false;
        } else {
          const prevPt = currentTimeline[i - 1];
          if (Math.abs(curr.x - prevPt.x) > WORLD_WIDTH / 2 || Math.abs(curr.y - prevPt.y) > WORLD_HEIGHT / 2) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(rx, ry);
          } else {
            ctx.lineTo(rx, ry);
          }
        }
      }
      ctx.strokeStyle = 'rgba(0, 180, 216, 0.35)';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // B) Sketched squares for a blocky tapering organic snake body with fluid interpolation
      for (let i = 0; i < totalPts; i++) {
        const curr = currentTimeline[i];
        const prev = currentTimeline[Math.max(0, i - 1)];
        let rx = curr.x;
        let ry = curr.y;

        if (Math.abs(curr.x - prev.x) < WORLD_WIDTH / 2 && Math.abs(curr.y - prev.y) < WORLD_HEIGHT / 2) {
          rx = prev.x + (curr.x - prev.x) * t;
          ry = prev.y + (curr.y - prev.y) * t;
        }

        const progress = i / totalPts;
        const s = 11 + progress * 7;
        rc.rectangle(rx - s / 2, ry - s / 2, s, s, {
          fill: '#48cae4',
          fillStyle: 'solid',
          stroke: '#0077b6',
          strokeWidth: 1.5,
          roughness: 0.6,
          bowing: 0.5,
        });
      }
    }

    // 5. Draw Cute Snake Head (Sketched filled square with interpolated slide & googly eyes)
    if (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAMEOVER') {
      const [px, py] = playerPosition;
      let hPx = px;
      let hPy = py;

      // Interpolate head position for fluid movement between steps
      if (totalPts >= 2) {
        const prev = currentTimeline[totalPts - 2];
        const curr = currentTimeline[totalPts - 1];
        if (Math.abs(curr.x - prev.x) < WORLD_WIDTH / 2 && Math.abs(curr.y - prev.y) < WORLD_HEIGHT / 2) {
          hPx = prev.x + (curr.x - prev.x) * t;
          hPy = prev.y + (curr.y - prev.y) * t;
        }
      }

      // Draw head square
      rc.rectangle(hPx - GRID_SIZE / 2, hPy - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE, {
        fill: '#48cae4',
        fillStyle: 'solid',
        stroke: '#0077b6',
        strokeWidth: 2.2,
        roughness: 0.8,
        bowing: 0.9,
      });

      // Calculate googly eyes position dynamically facing heading vector
      const angle = playerAngle;
      const leftEyeX = hPx + Math.cos(angle) * 5.5 - Math.sin(angle) * 5.0;
      const leftEyeY = hPy + Math.sin(angle) * 5.5 + Math.cos(angle) * 5.0;
      const rightEyeX = hPx + Math.cos(angle) * 5.5 + Math.sin(angle) * 5.0;
      const rightEyeY = hPy + Math.sin(angle) * 5.5 - Math.cos(angle) * 5.0;

      // Left eye outline + fill
      rc.circle(leftEyeX, leftEyeY, 7.5, {
        fill: '#ffffff',
        fillStyle: 'solid',
        stroke: '#000000',
        strokeWidth: 1.5,
        roughness: 0.5,
      });
      // Right eye outline + fill
      rc.circle(rightEyeX, rightEyeY, 7.5, {
        fill: '#ffffff',
        fillStyle: 'solid',
        stroke: '#000000',
        strokeWidth: 1.5,
        roughness: 0.5,
      });

      // Pupils (black circles looking forward)
      const pupilOffset = 1.0;
      const leftPupilX = leftEyeX + pupilOffset * Math.cos(angle);
      const pupilY_L = leftEyeY + pupilOffset * Math.sin(angle);
      const rightPupilX = rightEyeX + pupilOffset * Math.cos(angle);
      const pupilY_R = rightEyeY + pupilOffset * Math.sin(angle);

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(leftPupilX, pupilY_L, 2.0, 0, Math.PI * 2);
      ctx.arc(rightPupilX, pupilY_R, 2.0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Draw Glowing Target Sketched Star
    if (gameState === 'PLAYING' || gameState === 'PAUSED') {
      const [ox, oy] = orbPosition;
      
      const numPoints = 5;
      const pts: [number, number][] = [];
      const outerRad = COLLISION_RADII.orb * (1.1 + Math.sin(time * 5.0) * 0.08); // pulsing star
      const innerRad = outerRad * 0.45;

      for (let i = 0; i < numPoints * 2; i++) {
        const starAngle = (i * Math.PI) / numPoints - Math.PI / 2 + time * 1.6;
        const r = i % 2 === 0 ? outerRad : innerRad;
        pts.push([ox + Math.cos(starAngle) * r, oy + Math.sin(starAngle) * r]);
      }

      rc.polygon(pts, {
        fill: '#ffb703',
        fillStyle: 'zigzag',
        hachureGap: 3.5,
        hachureAngle: 45,
        stroke: '#fb8500',
        strokeWidth: 1.8,
        roughness: 1.2,
        bowing: 1.1,
      });
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        width={WORLD_WIDTH}
        height={WORLD_HEIGHT}
        className="notebook-paper-texture border-2 border-[#4a433f]/30 rounded-2xl shadow-xl max-w-full max-h-full aspect-[10/7] bg-[#f7f4ea]"
        onPointerDown={() => {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            if (ctx.state === 'suspended') ctx.resume();
          }
        }}
      />
    </div>
  );
}
export default GameCanvas2D;
