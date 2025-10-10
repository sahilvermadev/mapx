import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AuthSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      console.log('JWT Token found, logging in...');
      
      // Use the auth context login function
      login(token);
      
      // Clear URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      console.log('Token verification successful, redirecting...');
      // Redirect back to the home page
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 100);
    } else {
      console.error('No token found in URL parameters.');
      navigate('/');
    }
  }, [navigate, login]);

  return (
    <div className="loading-container">
      <h1>Logging you in...</h1>
      <p>Please wait while we set up your session.</p>
    </div>
  );
};

export default AuthSuccessPage;