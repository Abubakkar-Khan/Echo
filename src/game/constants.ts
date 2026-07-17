export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 700;

export const GRID_SIZE = 20; // grid step size in pixels

export const BASE_FPS = 8.0; // starting speed in grid steps per second

export const COLLISION_RADII = {
  player: 10,
  trail: 10,
  orb: 10,
};

// Grace ticks: how many steps of the player's own path to exclude from self-collision checks.
// 4 steps allows the head to move without colliding with its own immediate neck.
export const SELF_COLLISION_GRACE_TICKS = 4;
