import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NewPostsBannerProps {
  count: number;
  onShowNewPosts: () => void;
  onDismiss: () => void;
  variant?: 'default' | 'dark';
}

const NewPostsBanner: React.FC<NewPostsBannerProps> = ({
  count,
  onShowNewPosts,
  onDismiss,
  variant = 'default',
}) => {
  if (count === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-center mb-4"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-full shadow-sm backdrop-blur-sm transition-colors">
          <span className="text-sm font-medium text-foreground">
            {count} new {count === 1 ? 'post' : 'posts'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowNewPosts}
            className="h-7 px-2 text-xs font-medium hover:bg-primary/20 rounded-full"
          >
            <ArrowDown className="h-3.5 w-3.5 mr-1" />
            Show
          </Button>
          <button
            onClick={onDismiss}
            className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NewPostsBanner;

