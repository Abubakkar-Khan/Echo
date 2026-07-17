import React, { useRef, useState, useEffect } from 'react';
import rough from 'roughjs';

interface RoughBorderProps {
  children: React.ReactNode;
  className?: string;
  fill?: string;
  fillStyle?: 'hachure' | 'solid' | 'zigzag' | 'cross-hatch' | 'dots';
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  bowing?: number;
  hachureGap?: number;
}

export function RoughBorder({
  children,
  className = '',
  fill,
  fillStyle = 'hachure',
  stroke = '#2d2a29',
  strokeWidth = 2,
  roughness = 1.3,
  bowing = 1.2,
  hachureGap = 6,
}: RoughBorderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();

    // Use ResizeObserver to respond to layout updates dynamically
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    // Clear previous sketchy nodes
    svgRef.current.innerHTML = '';

    try {
      const rc = rough.svg(svgRef.current);
      
      // Draw sketchy box matching measured elements
      const rect = rc.rectangle(
        strokeWidth / 2 + 1, 
        strokeWidth / 2 + 1, 
        dimensions.width - strokeWidth - 2, 
        dimensions.height - strokeWidth - 2, 
        {
          fill: fill,
          fillStyle: fillStyle,
          fillWeight: 1.0,
          hachureGap: hachureGap,
          stroke: stroke,
          strokeWidth: strokeWidth,
          roughness: roughness,
          bowing: bowing,
        }
      );

      svgRef.current.appendChild(rect);
    } catch (e) {
      console.warn('Failed to render rough border:', e);
    }
  }, [dimensions, fill, fillStyle, stroke, strokeWidth, roughness, bowing, hachureGap]);

  return (
    <div ref={containerRef} className={`relative z-0 ${className}`}>
      {/* Sketchy SVG backdrop */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{ overflow: 'visible' }}
      />
      {/* Content wrapper */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}
export default RoughBorder;
