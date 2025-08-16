import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthSuccessPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      // Store the token
      localStorage.setItem('authToken', token);
      console.log('JWT Token stored successfully');
      
      // Verify the token was stored correctly
      const storedToken = localStorage.getItem('authToken');
      if (storedToken === token) {
        console.log('Token verification successful, redirecting...');
        // Redirect back to the home page after ensuring token is stored
        setTimeout(() => {
          navigate('/', { replace: true }); // Use replace to avoid back button issues
        }, 100);
      } else {
        console.error('Token storage verification failed');
        navigate('/');
      }
    } else {
      console.error('No token found in URL parameters.');
      navigate('/'); // Redirect to home, which will then show the modal
    }
  }, [navigate]);

  return (
    <div className="loading-container">
      <h1>Logging you in...</h1>
      <p>Please wait while we set up your session.</p>
    </div>
  );
};

export default AuthSuccessPage;