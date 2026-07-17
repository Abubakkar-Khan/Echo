export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 700;

export const PLAYER_SPEED = 220.0; // Base speed in pixels per second

export const SEGMENT_SPACING = 14.0; // Distance between body segments in pixels

export const COLLISION_RADII = {
  player: 10,
  trail: 7.5,
  orb: 12,
  powerup: 12,
};

// Grace segments: how many segments near the head to exclude from self-collision checks.
// Since segments drag continuously, we exclude the first 7 segments of the neck.
export const SELF_COLLISION_GRACE_SEGMENTS = 7;
