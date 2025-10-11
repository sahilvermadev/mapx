import { useState, useEffect } from 'react';

interface UseSmoothTransitionOptions {
  duration?: number;
  delay?: number;
}

export const useSmoothTransition = (
  isVisible: boolean,
  options: UseSmoothTransitionOptions = {}
) => {
  const { duration = 300, delay = 0 } = options;
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      const timer = setTimeout(() => {
        setIsAnimating(true);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, delay]);

  return {
    shouldRender,
    isAnimating,
    transitionClasses: `transition-all duration-${duration} ease-in-out ${
      isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
    }`
  };
};
