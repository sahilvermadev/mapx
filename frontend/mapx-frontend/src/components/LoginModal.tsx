import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaCheck, FaMapMarkedAlt, FaUsers, FaStar } from 'react-icons/fa';
import './LoginModal.css';

interface LoginModalProps {
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
  const [isLoading, setIsLoading] = useState(false);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      // Simulate a brief loading state for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      window.location.href = 'http://localhost:5000/auth/google';
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: <FaMapMarkedAlt />,
      text: 'Discover amazing places around you'
    },
    {
      icon: <FaUsers />,
      text: 'Share recommendations with friends'
    },
    {
      icon: <FaStar />,
      text: 'Rate and review your experiences'
    }
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="login-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="login-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close modal"
          >
            <FaTimes />
          </button>

          {/* Header */}
          <div className="login-modal-header">
            <div className="login-modal-logo">
              <FaMapMarkedAlt />
            </div>
            <h1 className="login-modal-title">Welcome to MapX</h1>
            <p className="login-modal-subtitle">
              Sign in to explore, save, and share amazing places with your community
            </p>
          </div>

          {/* Content */}
          <div className="login-modal-content">
            {/* Google Login Button */}
            <button
              className={`login-button ${isLoading ? 'loading' : ''}`}
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="button-text">
                {isLoading ? 'Signing in...' : 'Continue with Google'}
              </span>
            </button>

            {/* Divider */}
            <div className="login-divider">
              <span className="login-divider-text">What you'll get</span>
            </div>

            {/* Features */}
            <div className="login-features">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  className="login-feature"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                >
                  <div className="login-feature-icon">
                    <FaCheck />
                  </div>
                  <span>{feature.text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="login-modal-footer">
            <p>
              By signing in, you agree to our{' '}
              <a href="#" onClick={(e) => e.preventDefault()}>
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" onClick={(e) => e.preventDefault()}>
                Privacy Policy
              </a>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LoginModal;