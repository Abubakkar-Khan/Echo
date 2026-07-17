"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { HUD } from '../components/HUD';

// Load GameCanvas2D dynamically with client-side execution only
const GameCanvas2D = dynamic(() => import('../components/GameCanvas2D'), { ssr: false });

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#070514]">
      {/* 2D Canvas Layer */}
      <GameCanvas2D />

      {/* HTML HUD and Menu Overlays Layer */}
      <HUD />
    </main>
  );
}
