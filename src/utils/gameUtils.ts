import { WORLD_WIDTH, WORLD_HEIGHT, GRID_SIZE } from '../game/constants';

/**
 * Checks if a point (x, y) is inside the rectangular world boundaries.
 */
export function isInsideWorld(x: number, y: number): boolean {
  return x >= 0 && x <= WORLD_WIDTH && y >= 0 && y <= WORLD_HEIGHT;
}

/**
 * Generates a valid 2D random spawn position for the player, aligned to GRID_SIZE.
 */
export function getRandomSpawnPosition(orbPosition: [number, number]): [number, number] {
  const margin = 80;
  const buffer = 200; // Min distance from orb
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let x = margin + Math.random() * (WORLD_WIDTH - margin * 2);
    let y = margin + Math.random() * (WORLD_HEIGHT - margin * 2);

    // Round to nearest grid cell
    x = Math.round(x / GRID_SIZE) * GRID_SIZE;
    y = Math.round(y / GRID_SIZE) * GRID_SIZE;

    const dx = x - orbPosition[0];
    const dy = y - orbPosition[1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= buffer) {
      return [x, y];
    }
  }

  // Fallback to center, aligned to grid
  const cx = Math.round((WORLD_WIDTH / 2) / GRID_SIZE) * GRID_SIZE;
  const cy = Math.round((WORLD_HEIGHT / 2) / GRID_SIZE) * GRID_SIZE;
  return [cx, cy];
}

/**
 * Generates a valid 2D random orb position in the rectangular world, aligned to GRID_SIZE.
 */
export function getRandomOrbPosition(playerPosition: [number, number]): [number, number] {
  const margin = 80;
  const buffer = 220; // Min distance from player
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let x = margin + Math.random() * (WORLD_WIDTH - margin * 2);
    let y = margin + Math.random() * (WORLD_HEIGHT - margin * 2);

    // Round to nearest grid cell
    x = Math.round(x / GRID_SIZE) * GRID_SIZE;
    y = Math.round(y / GRID_SIZE) * GRID_SIZE;

    const dx = x - playerPosition[0];
    const dy = y - playerPosition[1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= buffer) {
      return [x, y];
    }
  }

  // Fallback
  const fx = Math.round((WORLD_WIDTH / 2) / GRID_SIZE) * GRID_SIZE;
  const fy = Math.round((WORLD_HEIGHT / 4) / GRID_SIZE) * GRID_SIZE;
  return [fx, fy];
}
