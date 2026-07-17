import { WORLD_WIDTH, WORLD_HEIGHT } from '../game/constants';

/**
 * Checks if a point (x, y) is inside the rectangular world boundaries.
 */
export function isInsideWorld(x: number, y: number): boolean {
  return x >= 0 && x <= WORLD_WIDTH && y >= 0 && y <= WORLD_HEIGHT;
}

/**
 * Generates a valid 2D random spawn position for the player.
 */
export function getRandomSpawnPosition(orbPosition: [number, number]): [number, number] {
  const margin = 80;
  const buffer = 200; // Min distance from orb
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = margin + Math.random() * (WORLD_WIDTH - margin * 2);
    const y = margin + Math.random() * (WORLD_HEIGHT - margin * 2);

    const dx = x - orbPosition[0];
    const dy = y - orbPosition[1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= buffer) {
      return [x, y];
    }
  }

  // Fallback to center
  return [WORLD_WIDTH / 2, WORLD_HEIGHT / 2];
}

/**
 * Generates a valid 2D random orb position in the rectangular world.
 */
export function getRandomOrbPosition(playerPosition: [number, number]): [number, number] {
  const margin = 80;
  const buffer = 220; // Min distance from player
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = margin + Math.random() * (WORLD_WIDTH - margin * 2);
    const y = margin + Math.random() * (WORLD_HEIGHT - margin * 2);

    const dx = x - playerPosition[0];
    const dy = y - playerPosition[1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= buffer) {
      return [x, y];
    }
  }

  // Fallback
  return [WORLD_WIDTH / 2, WORLD_HEIGHT / 4];
}
