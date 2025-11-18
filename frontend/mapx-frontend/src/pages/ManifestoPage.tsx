import React, { useState, useCallback } from 'react';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { RekkyManifesto } from '@/components/landing/RekkyManifesto';
import { LoginModal } from '@/auth';
import { Link } from 'react-router-dom';

const ManifestoPage: React.FC = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);

  const openLoginModal = useCallback(() => setShowLoginModal(true), []);
  const closeLoginModal = useCallback(() => setShowLoginModal(false), []);

  return (
    <div className="min-h-screen bg-black text-white">
      {showLoginModal && <LoginModal onClose={closeLoginModal} />}
      <Header onSignInClick={openLoginModal} variant="dark" />

      <main>
        <section className="px-4 sm:px-6 pt-16 sm:pt-24 pb-8 sm:pb-12 bg-gradient-to-b from-black via-zinc-900 to-black">
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-xs uppercase tracking-[0.35em] text-amber-200">Manifesto · Rekky notebook</p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
              An attempt to build a better Discovery Engine
            </h1>
            <p className="text-lg text-zinc-300 leading-relaxed">
              A 7-minute essay on why the open web can never again help you find the truly special — 
              and why small, private networks of real people are the only thing left that can.
            </p>
            <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.35em] text-zinc-500">
              <span>Published · Ongoing</span>
              <span>Reading time · 8 min</span>
            </div>
            <Link
              to="/landing"
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-white/70 hover:text-white transition"
            >
              ← Back to landing
            </Link>
          </div>
        </section>

        <RekkyManifesto />
      </main>

      <Footer variant="dark" />
    </div>
  );
};

export default ManifestoPage;


