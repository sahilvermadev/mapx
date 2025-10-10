import React from 'react';

interface AIResponseBannerProps {
  text: string;
  totals?: { places: number; recs: number };
}

const AIResponseBanner: React.FC<AIResponseBannerProps> = ({ text, totals }) => {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-lg shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-semibold">AI</span>
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-700 leading-relaxed mb-4">{text}</p>
          {totals && (
            <div className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
              Based on {totals.places} places • {totals.recs} reviews
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIResponseBanner;




