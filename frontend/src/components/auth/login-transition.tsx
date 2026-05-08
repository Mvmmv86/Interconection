'use client';

import { type FC, useEffect } from 'react';
import { motion } from 'framer-motion';

const CONNECT_DURATION = 1.6; // seconds for blocks to meet
const HOLD_DURATION = 0.6;    // seconds to hold after connection
const TOTAL_DURATION = (CONNECT_DURATION + HOLD_DURATION + 0.4) * 1000; // ms

interface LoginTransitionProps {
  onComplete: () => void;
}

// Reuse the Face component from animated-blocks-logo
const Face: FC<{ transform: string; className?: string }> = ({ transform, className = '' }) => (
  <div
    className={`absolute inset-0 border border-[#8b5cf6]/30 bg-[#1a1040]/40 backdrop-blur-md ${className}`}
    style={{ transform, backfaceVisibility: 'hidden' }}
  />
);

export function LoginTransition({ onComplete }: LoginTransitionProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, TOTAL_DURATION);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#040406]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Subtle radial glow behind blocks */}
      <div className="absolute w-[400px] h-[400px] bg-[#8b5cf6]/[0.04] rounded-full blur-[100px]" />

      <div className="flex flex-col items-center gap-8">
        {/* Blocks animation area */}
        <div
          className="relative w-52 h-52 flex items-center justify-center"
          style={{ perspective: '1200px' }}
        >
          <div
            className="relative w-full h-full flex items-center justify-center"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Connection energy line */}
            <motion.div
              className="absolute h-[2px] bg-[#8b5cf6] shadow-[0_0_20px_rgba(139,92,246,0.9)]"
              initial={{ width: 100, opacity: 0 }}
              animate={{ width: [100, 30, 0], opacity: [0, 1, 0] }}
              transition={{
                duration: CONNECT_DURATION,
                times: [0, 0.6, 0.9],
                ease: 'easeInOut',
              }}
            />

            {/* Slow 3D rotation */}
            <motion.div
              className="relative flex items-center justify-center"
              style={{ transformStyle: 'preserve-3d' }}
              animate={{ rotateY: [8, -8], rotateX: [8, 4] }}
              transition={{ duration: 6, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
            >
              {/* LEFT BLOCK */}
              <motion.div
                className="absolute w-16 h-16"
                style={{ transformStyle: 'preserve-3d', right: '50%' }}
                initial={{ x: -100 }}
                animate={{ x: 0 }}
                transition={{ duration: CONNECT_DURATION, ease: 'circOut' }}
              >
                <Face transform="translateZ(32px)" className="bg-gradient-to-br from-[#2d1b69]/50 to-[#1a1040]/70" />
                <Face transform="translateZ(-32px) rotateY(180deg)" />
                <Face transform="translateX(-32px) rotateY(-90deg)" />
                <Face transform="translateY(-32px) rotateX(90deg)" />
                <Face transform="translateY(32px) rotateX(-90deg)" />
                <div
                  className="absolute inset-0 bg-[#0f0a24]/90 border-2 border-[#8b5cf6]/50 flex items-center justify-center"
                  style={{ transform: 'translateX(32px) rotateY(90deg)', transformStyle: 'preserve-3d' }}
                >
                  <div className="w-8 h-8 bg-black/80 border border-[#8b5cf6]/30 shadow-[inset_0_0_8px_black]" />
                </div>
              </motion.div>

              {/* RIGHT BLOCK */}
              <motion.div
                className="absolute w-16 h-16"
                style={{ transformStyle: 'preserve-3d', left: '50%' }}
                initial={{ x: 100 }}
                animate={{ x: 0 }}
                transition={{ duration: CONNECT_DURATION, ease: 'circOut' }}
              >
                <Face transform="translateZ(32px)" className="bg-gradient-to-br from-[#1b2969]/50 to-[#0f1a40]/70 border-[#3b82f6]/30" />
                <Face transform="translateZ(-32px) rotateY(180deg)" className="border-[#3b82f6]/30" />
                <Face transform="translateX(32px) rotateY(90deg)" className="border-[#3b82f6]/30" />
                <Face transform="translateY(-32px) rotateX(90deg)" className="border-[#3b82f6]/30" />
                <Face transform="translateY(32px) rotateX(-90deg)" className="border-[#3b82f6]/30" />
                <div
                  className="absolute inset-0 bg-[#0a1024]/90 border-2 border-[#3b82f6]/50 flex items-center justify-center"
                  style={{ transform: 'translateX(-32px) rotateY(-90deg)', transformStyle: 'preserve-3d' }}
                >
                  <div
                    className="w-8 h-8 bg-[#3b82f6] shadow-[0_0_16px_rgba(59,130,246,0.6)] border border-[#93c5fd]/50"
                    style={{ transform: 'translateZ(8px)' }}
                  />
                </div>
              </motion.div>
            </motion.div>

            {/* Impact pulse on connection */}
            <motion.div
              className="absolute w-32 h-32 pointer-events-none"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.8, 0], opacity: [0, 0.9, 0] }}
              transition={{
                duration: 0.7,
                delay: CONNECT_DURATION,
                times: [0, 0.3, 1],
                ease: 'easeOut',
              }}
            >
              <div className="absolute inset-0 bg-[#8b5cf6] rounded-full blur-[30px] opacity-50" />
              <div className="absolute inset-0 border border-[#8b5cf6] rounded-full" />
            </motion.div>
          </div>
        </div>

        {/* Text that appears after connection */}
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: CONNECT_DURATION + 0.1, duration: 0.5, ease: 'easeOut' }}
        >
          <h2 className="text-xl font-bold bg-gradient-to-r from-[#8b5cf6] via-[#3b82f6] to-[#06b6d4] bg-clip-text text-transparent">
            Connecticoin
          </h2>
          <p className="text-[10px] font-mono tracking-[0.4em] text-[#8b5cf6]/70 uppercase">
            Conectando...
          </p>
        </motion.div>

        {/* Loading bar */}
        <motion.div
          className="w-48 h-[2px] bg-white/[0.06] rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: CONNECT_DURATION + 0.2 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-[#8b5cf6] to-[#3b82f6] rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{
              delay: CONNECT_DURATION + 0.2,
              duration: HOLD_DURATION + 0.2,
              ease: 'easeInOut',
            }}
          />
        </motion.div>
      </div>

      {/* Fade out at the end */}
      <motion.div
        className="absolute inset-0 bg-[#040406] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          delay: CONNECT_DURATION + HOLD_DURATION,
          duration: 0.4,
          ease: 'easeIn',
        }}
      />
    </motion.div>
  );
}
