import React from 'react';
import { motion } from 'framer-motion';
import './StatsCard.css';

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
    primary: 'stats-card--primary',
    secondary: 'stats-card--secondary',
    success: 'stats-card--success',
    warning: 'stats-card--warning',
    error: 'stats-card--error'
  };

  return (
    <motion.div
      className={`stats-card ${colorClasses[color]}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ 
        scale: 1.05,
        transition: { duration: 0.2 }
      }}
    >
      <div className="stats-card__icon">
        {icon}
      </div>
      
      <div className="stats-card__content">
        <h3 className="stats-card__title">{title}</h3>
        <div className="stats-card__value">
          {isRating && typeof value === 'number' ? (
            <span className="rating-value">
              {value}
              <span className="rating-max">/5</span>
            </span>
          ) : (
            <span className="number-value">{value}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StatsCard; 