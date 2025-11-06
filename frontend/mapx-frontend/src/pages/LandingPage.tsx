import React, { useState, useCallback } from 'react';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { ProblemSolution } from '@/components/landing/ProblemSolution';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { CallToAction } from '@/components/landing/CallToAction';
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

  const openLoginModal = useCallback(() => setShowLoginModal(true), []);
  const closeLoginModal = useCallback(() => setShowLoginModal(false), []);

  return (
    <div className="min-h-screen bg-white">
      {showLoginModal && <LoginModal onClose={closeLoginModal} />}
      <Header onSignInClick={openLoginModal} />
      <Hero />
      <ProblemSolution />
      <Features />
      <HowItWorks />
      <CallToAction />
      <Footer />
    </div>
  );
};

export default LandingPage;

