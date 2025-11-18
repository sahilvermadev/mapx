import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { SignalNoiseSection } from '@/components/landing/SignalNoiseSection';
import { TrustCommonsSection } from '@/components/landing/TrustCommonsSection';
import { FlywheelSection } from '@/components/landing/FlywheelSection';
import { PrinciplesSection } from '@/components/landing/PrinciplesSection';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { ManifestoPreviewSection } from '@/components/landing/ManifestoPreviewSection';
import { Footer } from '@/components/landing/Footer';
import { LoginModal } from '@/auth';

/**
 * LandingPage Component
 * 
 * Main marketing/landing page for unauthenticated users.
 * This page should not be affected by user theme preferences.
 */
const LandingPage: React.FC = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();

  const openLoginModal = useCallback(() => setShowLoginModal(true), []);
  const closeLoginModal = useCallback(() => setShowLoginModal(false), []);
  const goToManifesto = useCallback(() => navigate('/manifesto'), [navigate]);

  return (
    <div className="min-h-screen bg-white">
      {showLoginModal && <LoginModal onClose={closeLoginModal} />}
      <Header onSignInClick={openLoginModal} />
      <Hero onReadManifesto={goToManifesto} />
      <SignalNoiseSection />
      <ManifestoPreviewSection />
      <TrustCommonsSection />
      <FlywheelSection />
      <PrinciplesSection />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default LandingPage;

