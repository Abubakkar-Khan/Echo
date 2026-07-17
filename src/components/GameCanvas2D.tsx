import React, { useEffect, useRef } from 'react';
import rough from 'roughjs';
import { useGameStore } from '../store/useGameStore';
import { useInput } from '../hooks/useInput';
import { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_SPEED, SEGMENT_SPACING, COLLISION_RADII } from '../game/constants';

// Helper to convert hex strings to rgba format to support fading opacities
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Sketched pastel color palette for past loop ghosts (fully solid/vibrant)
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
    numSegments,
    hasShield,
    slowMoTimeLeft,
    immunityTicks,
    powerupPosition,
    powerupType,
    ghostReplayTicks,
  } = useGameStore();

  const inputRef = useInput();
  const animationFrameId = useRef<number>(0);
  const lastTime = useRef<number>(0);

  // Main game loop running physics ticker at 60Hz
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
        const step = 1 / 60; // 60Hz constant physics

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
  }, [gameState, physicsAccumulator, incrementTick, setAccumulator]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Clear background and draw notebook paper lines
    ctx.fillStyle = '#f7f4ea';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Blue graph-paper grid grids (20px spacing)
    ctx.strokeStyle = 'rgba(78, 122, 199, 0.13)';
    ctx.lineWidth = 1;
    for (let x = 0; x < WORLD_WIDTH; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < WORLD_HEIGHT; y += 20) {
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
    const step = 1 / 60;
    const t = Math.min(Math.max(physicsAccumulator / step, 0.0), 1.0);

    // Speed parameter to adjust segment step offsets
    const currentSpeed = PLAYER_SPEED + score * 12;
    const historyStep = Math.max(1, Math.round(SEGMENT_SPACING / (currentSpeed / 60)));

    // 4. Draw Past Replay Trails (Verlet Softbody segment chains in Solid Vibrant Colors)
    pastTimelines.forEach((timeline, j) => {
      const L = timeline.length;
      if (L === 0) return;

      const ghTick = ghostReplayTicks[j] ?? 0;
      const roundedTick = Math.min(Math.round(ghTick), L - 1);
      const prevRoundedTick = Math.max(0, roundedTick - 1);

      const ghostColor = GHOST_PALETTE[j % GHOST_PALETTE.length];
      const opacity = 0.85; // Solid opacity (no fade-away for older snakes!)

      // A) Draw thin dashed connector line with interpolated points
      ctx.beginPath();
      let first = true;
      const ghostSegments = 12 + j * 6; // segment length corresponding to that run
      
      for (let k = 0; k < ghostSegments; k++) {
        const currIdx = Math.max(0, roundedTick - k * historyStep);
        const prevIdx = Math.max(0, prevRoundedTick - k * historyStep);
        
        const currPt = timeline[currIdx];
        const prevPt = timeline[prevIdx];
        
        let rx = currPt.x;
        let ry = currPt.y;

        // Apply interpolation only if not wrapped
        if (ghTick < L - 1 && Math.abs(currPt.x - prevPt.x) < WORLD_WIDTH / 2 && Math.abs(currPt.y - prevPt.y) < WORLD_HEIGHT / 2) {
          rx = prevPt.x + (currPt.x - prevPt.x) * t;
          ry = prevPt.y + (currPt.y - prevPt.y) * t;
        }

        if (first) {
          ctx.moveTo(rx, ry);
          first = false;
        } else {
          // check if wrapped
          const lastIdx = Math.max(0, roundedTick - (k - 1) * historyStep);
          const lastPt = timeline[lastIdx];
          if (Math.abs(currPt.x - lastPt.x) > WORLD_WIDTH / 2 || Math.abs(currPt.y - lastPt.y) > WORLD_HEIGHT / 2) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(rx, ry);
          } else {
            ctx.lineTo(rx, ry);
          }
        }
      }
      ctx.save();
      ctx.strokeStyle = hexToRgba(ghostColor.stroke, opacity * 0.4);
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      // B) Draw Ghost body blocks (overlapping organic circles)
      // Render from tail to head
      for (let k = ghostSegments - 1; k >= 0; k--) {
        const currIdx = Math.max(0, roundedTick - k * historyStep);
        const prevIdx = Math.max(0, prevRoundedTick - k * historyStep);
        
        const currPt = timeline[currIdx];
        const prevPt = timeline[prevIdx];
        
        let rx = currPt.x;
        let ry = currPt.y;

        if (ghTick < L - 1 && Math.abs(currPt.x - prevPt.x) < WORLD_WIDTH / 2 && Math.abs(currPt.y - prevPt.y) < WORLD_HEIGHT / 2) {
          rx = prevPt.x + (currPt.x - prevPt.x) * t;
          ry = prevPt.y + (currPt.y - prevPt.y) * t;
        }

        const progress = (ghostSegments - 1 - k) / ghostSegments;
        const rad = 4.5 + progress * 5.0; // Tapering segment radius
        
        const fillRgba = hexToRgba(ghostColor.fill, opacity * 0.7);
        const strokeRgba = hexToRgba(ghostColor.stroke, opacity * 0.9);

        rc.circle(rx, ry, rad * 2, {
          fill: fillRgba,
          fillStyle: 'solid',
          stroke: strokeRgba,
          strokeWidth: 1.0,
          roughness: 0.8,
          bowing: 0.6,
        });
      }

      // C) Draw Replay Ghost Head (interpolated cute face)
      const head = timeline[roundedTick];
      const prevHead = timeline[prevRoundedTick];
      let ghx = head.x;
      let ghy = head.y;

      if (ghTick < L - 1 && Math.abs(head.x - prevHead.x) < WORLD_WIDTH / 2 && Math.abs(head.y - prevHead.y) < WORLD_HEIGHT / 2) {
        ghx = prevHead.x + (head.x - prevHead.x) * t;
        ghy = prevHead.y + (head.y - prevHead.y) * t;
      }

      rc.circle(ghx, ghy, COLLISION_RADII.player * 2, {
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

    // 5. Draw Player Trail & Softbody Body (Tapering overlapping organic circles)
    const totalPts = currentTimeline.length;
    if (totalPts >= 2) {
      // A) Draw thin connector line with interpolated wrap checks
      ctx.beginPath();
      let first = true;
      for (let k = 0; k < numSegments; k++) {
        const currIdx = Math.max(0, totalPts - 1 - k * historyStep);
        const prevIdx = Math.max(0, totalPts - 2 - k * historyStep);
        
        const curr = currentTimeline[currIdx];
        const prev = currentTimeline[prevIdx];
        
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
          const lastIdx = Math.max(0, totalPts - 1 - (k - 1) * historyStep);
          const lastPt = currentTimeline[lastIdx];
          if (Math.abs(curr.x - lastPt.x) > WORLD_WIDTH / 2 || Math.abs(curr.y - lastPt.y) > WORLD_HEIGHT / 2) {
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

      // B) Sketched overlapping circles for a softbody organic snake body
      for (let k = numSegments - 1; k >= 0; k--) {
        const currIdx = Math.max(0, totalPts - 1 - k * historyStep);
        const prevIdx = Math.max(0, totalPts - 2 - k * historyStep);
        
        const curr = currentTimeline[currIdx];
        const prev = currentTimeline[prevIdx];
        
        let rx = curr.x;
        let ry = curr.y;

        if (Math.abs(curr.x - prev.x) < WORLD_WIDTH / 2 && Math.abs(curr.y - prev.y) < WORLD_HEIGHT / 2) {
          rx = prev.x + (curr.x - prev.x) * t;
          ry = prev.y + (curr.y - prev.y) * t;
        }

        const progress = (numSegments - 1 - k) / numSegments;
        const rad = 5.0 + progress * 6.5; // Tapering from 5.0px at tail to 11.5px near head
        
        rc.circle(rx, ry, rad * 2, {
          fill: '#48cae4',
          fillStyle: 'solid',
          stroke: '#0077b6',
          strokeWidth: 1.5,
          roughness: 0.6,
          bowing: 0.5,
        });
      }
    }

    // 6. Draw Cute Snake Head (Sketched circle with googly eyes)
    if (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAMEOVER') {
      const [px, py] = playerPosition;
      let hPx = px;
      let hPy = py;

      // Interpolate head position
      if (totalPts >= 2) {
        const prev = currentTimeline[totalPts - 2];
        const curr = currentTimeline[totalPts - 1];
        if (Math.abs(curr.x - prev.x) < WORLD_WIDTH / 2 && Math.abs(curr.y - prev.y) < WORLD_HEIGHT / 2) {
          hPx = prev.x + (curr.x - prev.x) * t;
          hPy = prev.y + (curr.y - prev.y) * t;
        }
      }

      // If post-shield immunity is active, flicker the head slightly
      const isImmuneFlicker = immunityTicks > 0 && Math.floor(immunityTicks / 5) % 2 === 0;

      if (!isImmuneFlicker) {
        // Draw head circle
        rc.circle(hPx, hPy, COLLISION_RADII.player * 2, {
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

      // Draw active shield circular energy ring bubble
      if (hasShield) {
        rc.circle(hPx, hPy, COLLISION_RADII.player * 2.8, {
          stroke: '#00b4d8',
          strokeWidth: 2.2,
          roughness: 1.6,
          bowing: 1.2,
        });
      }
    }

    // 7. Draw Collectible Upgrade Powerup Item
    if ((gameState === 'PLAYING' || gameState === 'PAUSED') && powerupPosition !== null && powerupType !== null) {
      const [ux, uy] = powerupPosition;
      
      if (powerupType === 'SHIELD') {
        // Draw blue shield bubble circle with cross
        rc.circle(ux, uy, COLLISION_RADII.powerup * 2, {
          fill: '#b5e2fa',
          fillStyle: 'zigzag',
          stroke: '#0077b6',
          strokeWidth: 1.8,
          roughness: 1.0,
        });
        ctx.strokeStyle = '#0077b6';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ux - 5, uy);
        ctx.lineTo(ux + 5, uy);
        ctx.moveTo(ux, uy - 5);
        ctx.lineTo(ux, uy + 5);
        ctx.stroke();
      } else if (powerupType === 'SLOWMO') {
        // Draw violet clock circle with clock hands
        rc.circle(ux, uy, COLLISION_RADII.powerup * 2, {
          fill: '#dec0f1',
          fillStyle: 'zigzag',
          stroke: '#7209b7',
          strokeWidth: 1.8,
          roughness: 1.0,
        });
        ctx.strokeStyle = '#7209b7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ux, uy);
        ctx.lineTo(ux, uy - 7);
        ctx.moveTo(ux, uy);
        ctx.lineTo(ux + 5, uy);
        ctx.stroke();
      } else if (powerupType === 'ERASER') {
        // Draw pink rectangular eraser
        rc.rectangle(ux - 9, uy - 9, 18, 18, {
          fill: '#ffc6ff',
          fillStyle: 'zigzag',
          stroke: '#b5179e',
          strokeWidth: 1.8,
          roughness: 1.0,
        });
        ctx.strokeStyle = '#b5179e';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(ux - 5, uy - 5);
        ctx.lineTo(ux + 5, uy + 5);
        ctx.stroke();
      }
    }

    // 8. Draw Glowing Target Sketched Star
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
