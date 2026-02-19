'use client';

import { type FC } from 'react';
import { motion } from 'framer-motion';

// ── Single face of a 3D cube ──
const Face: FC<{ transform: string; className?: string }> = ({ transform, className = '' }) => (
  <div
    className={`absolute inset-0 border border-[#8b5cf6]/30 bg-[#1a1040]/40 backdrop-blur-md ${className}`}
    style={{ transform, backfaceVisibility: 'hidden' }}
  />
);

// ── Animation timing ──
const CONNECT_DURATION = 2; // seconds to connect (one-shot, no loop)

/**
 * Two 3D blockchain blocks that connect like lego pieces.
 * Left = socket (female), Right = stud (male).
 * Colors adapted to Interconection design system (purple → blue → cyan).
 */
export function AnimatedBlocksLogo() {
  return (
    <div className="flex flex-col items-center select-none">
      {/* Blocks area */}
      <div
        className="relative flex items-center justify-center h-52 w-full overflow-visible mb-6"
        style={{ perspective: '1200px' }}
      >
        <div className="relative w-full h-full flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>

          {/* Connection line between blocks */}
          <motion.div
            className="absolute h-[1px] bg-[#8b5cf6] shadow-[0_0_15px_rgba(139,92,246,0.8)]"
            initial={{ width: 120, opacity: 0 }}
            animate={{ width: [120, 40, 0], opacity: [0, 1, 0] }}
            transition={{
              duration: CONNECT_DURATION,
              times: [0, 0.6, 0.9],
              ease: 'easeInOut',
            }}
          />

          {/* Global slow rotation for the assembly */}
          <motion.div
            className="relative flex items-center justify-center"
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: [10, -10, 10], rotateX: [10, 5, 10] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          >

            {/* ── LEFT BLOCK (Socket / Female) ── */}
            <motion.div
              className="absolute w-20 h-20"
              style={{ transformStyle: 'preserve-3d', right: '50%' }}
              initial={{ x: -120 }}
              animate={{ x: 0 }}
              transition={{
                duration: CONNECT_DURATION,
                ease: 'circOut',
              }}
            >
              {/* 6 faces */}
              <Face transform="translateZ(40px)" className="bg-gradient-to-br from-[#2d1b69]/50 to-[#1a1040]/70" />
              <Face transform="translateZ(-40px) rotateY(180deg)" />
              <Face transform="translateX(-40px) rotateY(-90deg)" />
              <Face transform="translateY(-40px) rotateX(90deg)" />
              <Face transform="translateY(40px) rotateX(-90deg)" />

              {/* Socket face (right side) — the "hole" */}
              <div
                className="absolute inset-0 bg-[#0f0a24]/90 border-2 border-[#8b5cf6]/50 flex items-center justify-center"
                style={{ transform: 'translateX(40px) rotateY(90deg)', transformStyle: 'preserve-3d' }}
              >
                {/* Central recess */}
                <div className="w-10 h-10 bg-black/80 border border-[#8b5cf6]/30 shadow-[inset_0_0_10px_black]" />
                {/* Detail dots */}
                <div className="absolute top-2 left-2 w-1 h-1 bg-[#8b5cf6]/40 rounded-full" />
                <div className="absolute top-2 right-2 w-1 h-1 bg-[#8b5cf6]/40 rounded-full" />
                <div className="absolute bottom-2 left-2 w-1 h-1 bg-[#8b5cf6]/40 rounded-full" />
                <div className="absolute bottom-2 right-2 w-1 h-1 bg-[#8b5cf6]/40 rounded-full" />
              </div>
            </motion.div>

            {/* ── RIGHT BLOCK (Stud / Male) ── */}
            <motion.div
              className="absolute w-20 h-20"
              style={{ transformStyle: 'preserve-3d', left: '50%' }}
              initial={{ x: 120 }}
              animate={{ x: 0 }}
              transition={{
                duration: CONNECT_DURATION,
                ease: 'circOut',
              }}
            >
              {/* 5 faces */}
              <Face transform="translateZ(40px)" className="bg-gradient-to-br from-[#1b2969]/50 to-[#0f1a40]/70 border-[#3b82f6]/30" />
              <Face transform="translateZ(-40px) rotateY(180deg)" className="border-[#3b82f6]/30" />
              <Face transform="translateX(40px) rotateY(90deg)" className="border-[#3b82f6]/30" />
              <Face transform="translateY(-40px) rotateX(90deg)" className="border-[#3b82f6]/30" />
              <Face transform="translateY(40px) rotateX(-90deg)" className="border-[#3b82f6]/30" />

              {/* Stud face (left side) — the connector */}
              <div
                className="absolute inset-0 bg-[#0a1024]/90 border-2 border-[#3b82f6]/50 flex items-center justify-center"
                style={{ transform: 'translateX(-40px) rotateY(-90deg)', transformStyle: 'preserve-3d' }}
              >
                {/* 3D stud block */}
                <div
                  className="w-10 h-10 bg-[#3b82f6] shadow-[0_0_20px_rgba(59,130,246,0.6)] border border-[#93c5fd]/50"
                  style={{ transform: 'translateZ(10px)', transformStyle: 'preserve-3d' }}
                >
                  {/* Stud faces for 3D depth */}
                  <div className="absolute inset-0 bg-[#60a5fa]" style={{ transform: 'translateZ(5px)' }} />
                  <div className="absolute top-0 bottom-0 -left-[5px] w-[5px] bg-[#2563eb] origin-right" style={{ transform: 'rotateY(-90deg)' }} />
                  <div className="absolute top-0 bottom-0 -right-[5px] w-[5px] bg-[#2563eb] origin-left" style={{ transform: 'rotateY(90deg)' }} />
                  <div className="absolute left-0 right-0 -top-[5px] h-[5px] bg-[#93c5fd] origin-bottom" style={{ transform: 'rotateX(90deg)' }} />
                  <div className="absolute left-0 right-0 -bottom-[5px] h-[5px] bg-[#1d4ed8] origin-top" style={{ transform: 'rotateX(-90deg)' }} />
                </div>
              </div>
            </motion.div>

          </motion.div>

          {/* Impact / Lock pulse */}
          <motion.div
            className="absolute w-40 h-40 pointer-events-none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 0], opacity: [0, 0.8, 0] }}
            transition={{
              duration: 0.8,
              delay: CONNECT_DURATION,
              times: [0, 0.3, 1],
              ease: 'easeOut',
            }}
          >
            <div className="absolute inset-0 bg-[#8b5cf6] rounded-full blur-[40px] opacity-40" />
            <div className="absolute inset-0 border border-[#8b5cf6] rounded-full" />
          </motion.div>

          {/* Status text — appears after connection and stays */}
          <motion.div
            className="absolute -bottom-2 text-[10px] font-mono tracking-[0.4em] text-[#8b5cf6] whitespace-nowrap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: CONNECT_DURATION + 0.2,
              duration: 0.6,
              ease: 'easeOut',
            }}
          >
            BLOCKS_CONNECTED
          </motion.div>
        </div>
      </div>

      {/* "Interconection" text */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-r from-[#8b5cf6] via-[#3b82f6] to-[#06b6d4] bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(139,92,246,0.3)]">
          Interconection
        </h1>
      </motion.div>

      {/* Subtitle */}
      <motion.div className="mt-3 flex items-center justify-center gap-4">
        <motion.div
          className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[#8b5cf6]/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.8 }}
        />
        <motion.p
          className="text-sm md:text-base tracking-[0.3em] uppercase text-white/40 font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.8, ease: 'easeOut' }}
        >
          Treasury Management
        </motion.p>
        <motion.div
          className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[#3b82f6]/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.8 }}
        />
      </motion.div>

      {/* Tagline */}
      <motion.p
        className="mt-6 max-w-md text-center text-white/30 text-sm leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.3, duration: 1 }}
      >
        Unified treasury visibility across exchanges, wallets, DeFi protocols
        and staking — all in one platform.
      </motion.p>
    </div>
  );
}
