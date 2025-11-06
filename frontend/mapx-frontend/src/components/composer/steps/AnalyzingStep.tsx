import React from 'react';
import { motion } from 'framer-motion';

export const AnalyzingStep: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="text-center space-y-8 py-8"
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex justify-center">
          <div className="rounded-md border-2 border-black bg-white p-6 shadow-[4px_4px_0_0_#000]">
          <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-2 border-black border-t-transparent"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 bg-yellow-300"></div>
              </div>
            </div>
          </div>
        </div>
        
        <h1 className="text-4xl font-semibold text-black leading-tight">
          Analyzing
        </h1>
      </div>
    </motion.div>
  );
};

export default AnalyzingStep;






