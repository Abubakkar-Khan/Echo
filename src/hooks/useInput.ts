import { useEffect, useRef } from 'react';

export interface InputVector {
  x: number;
  z: number;
}

export function useInput() {
  const keys = useRef<{ [key: string]: boolean }>({
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
  });

  const inputVector = useRef<InputVector>({ x: 0, z: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code in keys.current) {
        keys.current[e.code] = true;
        updateInputVector();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code in keys.current) {
        keys.current[e.code] = false;
        updateInputVector();
      }
    };

    const updateInputVector = () => {
      let x = 0;
      let z = 0;

      // Vertical movement (W/S or Up/Down arrows)
      if (keys.current.KeyW || keys.current.ArrowUp) {
        z -= 1; // Move along -Z (forward)
      }
      if (keys.current.KeyS || keys.current.ArrowDown) {
        z += 1; // Move along +Z (backward)
      }

      // Horizontal movement (A/D or Left/Right arrows)
      if (keys.current.KeyA || keys.current.ArrowLeft) {
        x -= 1; // Move along -X (left)
      }
      if (keys.current.KeyD || keys.current.ArrowRight) {
        x += 1; // Move along +X (right)
      }

      // Normalize diagonal vectors so diagonal moving isn't faster
      if (x !== 0 && z !== 0) {
        const length = Math.sqrt(x * x + z * z);
        x /= length;
        z /= length;
      }

      inputVector.current = { x, z };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return inputVector;
}
