import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { X, Check, AlertCircle, User } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface UsernameSetupModalProps {
  onClose: () => void;
  onComplete: (username: string) => void;
}

interface UsernameCheckResult {
  available: boolean;
  username: string;
  error?: string;
}

const UsernameSetupModal: React.FC<UsernameSetupModalProps> = ({ onClose, onComplete }) => {
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<UsernameCheckResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced username checking
  useEffect(() => {
    if (!username || username.length < 3) {
      setCheckResult(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsChecking(true);
      try {
        const response = await fetch(`http://localhost:5000/api/username/check/${encodeURIComponent(username)}`, {
          headers: {
            'Authorization': `Bearer ${apiClient.getToken()}`
          }
        });
        const result = await response.json();
        setCheckResult(result);
      } catch (err) {
        console.error('Username check error:', err);
        setCheckResult({ available: false, username, error: 'Failed to check username' });
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!checkResult?.available) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/api/username/set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiClient.getToken()}`
        },
        body: JSON.stringify({ username })
      });

      const result = await response.json();

      if (response.ok) {
        onComplete(username);
      } else {
        setError(result.error || 'Failed to set username');
      }
    } catch (err) {
      console.error('Set username error:', err);
      setError('Failed to set username');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = checkResult?.available === true;
  const canSubmit = isValid && !isSubmitting;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-xl w-full max-w-md shadow-lg border border-gray-200 relative"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-8 w-8 rounded-md hover:bg-gray-100"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Content */}
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Choose Your Username</h2>
              <p className="text-sm text-gray-600 mt-1">
                This will be your unique identifier on Recce
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className={`pr-10 ${
                      checkResult?.available === false 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                        : checkResult?.available === true 
                        ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
                        : ''
                    }`}
                    disabled={isSubmitting}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {isChecking && (
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    )}
                    {!isChecking && checkResult?.available === true && (
                      <Check className="w-4 h-4 text-green-600" />
                    )}
                    {!isChecking && checkResult?.available === false && (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                </div>
                
                {/* Username feedback */}
                {checkResult && (
                  <div className="mt-2 text-sm">
                    {checkResult.available === true && (
                      <p className="text-green-600 flex items-center">
                        <Check className="w-4 h-4 mr-1" />
                        {checkResult.username} is available
                      </p>
                    )}
                    {checkResult.available === false && (
                      <p className="text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {checkResult.error || `${checkResult.username} is not available`}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Username requirements */}
              <div className="text-xs text-gray-500 space-y-1">
                <p>• 3-20 characters long</p>
                <p>• Letters, numbers, and underscores only</p>
                <p>• Must be unique</p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!canSubmit}
              >
                {isSubmitting ? 'Setting up...' : 'Complete Setup'}
              </Button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UsernameSetupModal;
