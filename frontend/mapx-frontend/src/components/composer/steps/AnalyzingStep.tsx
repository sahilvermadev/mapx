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
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-400"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
        
        <h1 className="text-4xl font-light text-black leading-tight">
          Analyzing your recommendation
        </h1>
      </div>
    </motion.div>
  );
};

export default AnalyzingStep;






