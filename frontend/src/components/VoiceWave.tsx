import React from "react";
import { motion } from "framer-motion";

export const VoiceWave = () => {
  return (
    <div className="flex items-center gap-3 h-full">
      <div className="flex items-center gap-1 h-8">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="w-1 bg-green-500 rounded-full"
            animate={{
              height: ["20%", "80%", "20%"],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut",
            }}
            style={{
              height: "40%",
            }}
          />
        ))}
      </div>
    </div>
  );
};
