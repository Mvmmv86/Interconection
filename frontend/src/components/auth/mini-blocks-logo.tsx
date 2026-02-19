'use client';

import { type FC } from 'react';

/**
 * Tiny version of the blockchain blocks logo for sidebar use.
 * Two mini cubes that separate and connect on a loop — matches the login page animation.
 */

const MiniFace: FC<{ transform: string; className?: string }> = ({ transform, className = '' }) => (
  <div
    className={`absolute inset-0 border border-[#8b5cf6]/40 bg-[#1a1040]/50 ${className}`}
    style={{ transform, backfaceVisibility: 'hidden' }}
  />
);

export function MiniBlocksLogo() {
  return (
    <div
      className="w-6 h-6 flex items-center justify-center"
      style={{ perspective: '180px' }}
    >
      <div
        className="relative w-full h-full flex items-center justify-center mini-blocks-assembly"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Left mini block */}
        <div
          className="absolute w-[9px] h-[9px] mini-block-left"
          style={{ transformStyle: 'preserve-3d', right: '50%' }}
        >
          <MiniFace transform="translateZ(4.5px)" className="bg-gradient-to-br from-[#2d1b69]/60 to-[#1a1040]/80" />
          <MiniFace transform="translateZ(-4.5px) rotateY(180deg)" />
          <MiniFace transform="translateX(-4.5px) rotateY(-90deg)" />
          <MiniFace transform="translateX(4.5px) rotateY(90deg)" className="bg-[#0f0a24]/90 border-[#8b5cf6]/50" />
          <MiniFace transform="translateY(-4.5px) rotateX(90deg)" />
          <MiniFace transform="translateY(4.5px) rotateX(-90deg)" />
        </div>

        {/* Right mini block */}
        <div
          className="absolute w-[9px] h-[9px] mini-block-right"
          style={{ transformStyle: 'preserve-3d', left: '50%' }}
        >
          <MiniFace transform="translateZ(4.5px)" className="bg-gradient-to-br from-[#1b2969]/60 to-[#0f1a40]/80 border-[#3b82f6]/40" />
          <MiniFace transform="translateZ(-4.5px) rotateY(180deg)" className="border-[#3b82f6]/40" />
          <MiniFace transform="translateX(4.5px) rotateY(90deg)" className="border-[#3b82f6]/40" />
          <MiniFace transform="translateX(-4.5px) rotateY(-90deg)" className="bg-[#0a1024]/90 border-[#3b82f6]/50" />
          <MiniFace transform="translateY(-4.5px) rotateX(90deg)" className="border-[#3b82f6]/40" />
          <MiniFace transform="translateY(4.5px) rotateX(-90deg)" className="border-[#3b82f6]/40" />
        </div>
      </div>

      <style jsx>{`
        .mini-blocks-assembly {
          animation: miniRotate 10s linear infinite;
        }
        @keyframes miniRotate {
          0%   { transform: rotateX(10deg) rotateY(10deg); }
          50%  { transform: rotateX(5deg) rotateY(-10deg); }
          100% { transform: rotateX(10deg) rotateY(10deg); }
        }
        .mini-block-left {
          animation: miniConnectLeft 4s ease-in-out infinite;
        }
        .mini-block-right {
          animation: miniConnectRight 4s ease-in-out infinite;
        }
        @keyframes miniConnectLeft {
          0%, 10% { transform: translateX(-6px); }
          45%, 80% { transform: translateX(0px); }
          100% { transform: translateX(-6px); }
        }
        @keyframes miniConnectRight {
          0%, 10% { transform: translateX(6px); }
          45%, 80% { transform: translateX(0px); }
          100% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
