"use client";

import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface PreloaderProps {
  message?: string;
  className?: string;
}

export function Preloader({ message = "Initializing workspace...", className }: PreloaderProps) {
  return (
    <div className={cn(
      "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background",
      className
    )}>
      <div className="relative flex flex-col items-center">
        {/* Animated Background Glow */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute h-64 w-64 rounded-full bg-primary/20 blur-[80px]"
        />

        {/* Logo Container */}
        <div className="relative flex items-center justify-center mb-8">
          {/* Outer Rotating Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute h-32 w-32 rounded-full border-b-2 border-primary/40 border-l-2 border-primary/10"
          />
          
          {/* Middle Pulse Ring */}
          <motion.div
            animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute h-24 w-24 rounded-full border border-primary/20"
          />

          {/* Central Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative h-16 w-16 flex items-center justify-center rounded-2xl bg-background/50 backdrop-blur-sm border border-primary/20 shadow-elegant"
          >
            <span className="text-2xl font-bold text-primary tracking-tighter">CN</span>
          </motion.div>
        </div>

        {/* Text Content */}
        <div className="text-center space-y-3">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent"
          >
            CodeNext IT
          </motion.h2>
          
          <div className="flex flex-col items-center gap-4">
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-sm font-medium text-muted-foreground/80 tracking-widest uppercase flex items-center gap-2"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              {message}
            </motion.p>

            {/* Progress Bar */}
            <div className="h-1 w-48 bg-primary/10 rounded-full overflow-hidden">
              <motion.div
                animate={{
                  x: ["-100%", "100%"]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="h-full w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Background Micro-particles (Decorative) */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 h-1 w-1 bg-primary rounded-full animate-pulse" />
        <div className="absolute top-3/4 left-1/3 h-1 w-1 bg-primary rounded-full animate-pulse delay-700" />
        <div className="absolute top-1/2 right-1/4 h-1 w-1 bg-primary rounded-full animate-pulse delay-1000" />
      </div>
    </div>
  );
}
