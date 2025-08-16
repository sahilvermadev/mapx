import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MapPage from './pages/MapPage';
import AuthSuccessPage from './pages/AuthSuccessPage';
import ProfilePage from './pages/ProfilePage';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/auth/success" element={<AuthSuccessPage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
      </Routes>
    </Router>
  );
};

export default App;