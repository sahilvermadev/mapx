import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface AIResponseBannerProps {
  text: string;
  totals?: { places: number; recs: number };
  isLoading?: boolean;
}

const AIResponseBanner: React.FC<AIResponseBannerProps> = ({ text, totals, isLoading }) => {
  return (
    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-500 p-6 rounded-r-lg shadow-lg">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full flex items-center justify-center shadow-md">
          <span className="text-white text-sm font-bold">AI</span>
        </div>
        <div className="flex-1">
          <div className="text-sm leading-relaxed mb-4">
            {(!text || text.trim().length === 0) && isLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-yellow-100 rounded w-11/12" />
                <div className="h-4 bg-yellow-100 rounded w-9/12" />
                <div className="h-4 bg-yellow-100 rounded w-10/12" />
              </div>
            ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="text-yellow-600">🎯</span>
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2">
                    <span className="text-yellow-600">📊</span>
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-medium text-foreground mb-2">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-sm leading-relaxed mb-3">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 text-sm mb-3 ml-4">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="text-sm leading-relaxed">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-muted-foreground">{children}</em>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-yellow-500 pl-4 italic text-muted-foreground bg-yellow-50 py-3 rounded-r-lg my-4">
                    {children}
                  </blockquote>
                ),
                hr: () => (
                  <hr className="border-t-2 border-yellow-200 my-4" />
                )
              }}
            >
              {text}
            </ReactMarkdown>
            )}
          </div>
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




