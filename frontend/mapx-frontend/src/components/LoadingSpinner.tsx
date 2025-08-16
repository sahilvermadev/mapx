import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'white' | 'gray';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = 'primary' 
}) => {
  const sizeClasses = {
    small: 'spinner--small',
    medium: 'spinner--medium',
    large: 'spinner--large'
  };

  const colorClasses = {
    primary: 'spinner--primary',
    white: 'spinner--white',
    gray: 'spinner--gray'
  };

  return (
    <div className={`spinner ${sizeClasses[size]} ${colorClasses[color]}`}>
      <div className="spinner__ring"></div>
      <div className="spinner__ring"></div>
      <div className="spinner__ring"></div>
    </div>
  );
};

export default LoadingSpinner; 