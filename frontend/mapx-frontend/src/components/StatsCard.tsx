import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  isRating?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  color,
  isRating = false
}) => {
  const colorClasses = {
    primary: 'text-primary',
    secondary: 'text-secondary-foreground',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-destructive'
  };

  const bgColorClasses = {
    primary: 'bg-primary/10',
    secondary: 'bg-secondary',
    success: 'bg-green-100',
    warning: 'bg-yellow-100',
    error: 'bg-destructive/10'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ 
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
    >
      <Card className="h-full">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg",
              bgColorClasses[color]
            )}>
              <div className={cn("h-6 w-6", colorClasses[color])}>
                {icon}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-muted-foreground truncate">
                {title}
              </h3>
              <div className="mt-1">
                {isRating && typeof value === 'number' ? (
                  <span className="text-2xl font-bold">
                    {value}
                    <span className="text-sm font-normal text-muted-foreground">/5</span>
                  </span>
                ) : (
                  <span className="text-2xl font-bold">
                    {value}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StatsCard; 