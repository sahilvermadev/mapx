
// Import landing page components
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { ProblemSolution } from '@/components/landing/ProblemSolution';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { SocialProof } from '@/components/landing/SocialProof';
import { CallToAction } from '@/components/landing/CallToAction';
import { Footer } from '@/components/landing/Footer';
import LoginModal from '@/components/LoginModal';
import { useState } from 'react';

const LandingPage = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);

  const openLoginModal = () => setShowLoginModal(true);
  const closeLoginModal = () => setShowLoginModal(false);

  return (
    <div className="min-h-screen">
      {showLoginModal && <LoginModal onClose={closeLoginModal} />}
      <Header onSignInClick={openLoginModal} />
      <Hero />
      <ProblemSolution />
      <Features />
      <HowItWorks />
      {/* <SocialProof /> */}
      <CallToAction />
      <Footer />
    </div>
  );
};

export default LandingPage;
