type HeroProps = {
  onReadManifesto?: () => void;
};

export function Hero({ onReadManifesto }: HeroProps) {
  return (
    <section className="bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 lg:py-40">
        <div className="flex flex-col lg:flex-row gap-12 sm:gap-16 lg:gap-20 items-start">
          <div className="space-y-8 max-w-2xl w-full">
            <div className="text-[11px] sm:text-xs uppercase tracking-[0.3em] text-zinc-400">
              Invite-only · Private network AI
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-medium tracking-tight leading-[1.1]">
                  Stop trusting the internet.
                </h1>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-medium tracking-tight leading-[1.1]">
                  Start trusting your network.
                </h1>
              </div>
              <p className="text-lg sm:text-xl text-zinc-300 leading-relaxed max-w-xl">
                Rekky rebuilds discovery around small, high-trust networks. Private vaults, taste-based search,
                and AI that only learns from people you actually know.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4 w-full">
              {/* <button
                onClick={onJoinClick}
                className="inline-flex items-center justify-center px-8 py-3 border border-white/20 bg-white/5 text-white font-medium tracking-tight hover:bg-white/10 hover:border-white/30 transition-colors"
              >
                Request access
              </button> */}
              {onReadManifesto ? (
                <button
                  onClick={onReadManifesto}
                  className="inline-flex items-center justify-center px-8 py-3 border border-white/10 text-white/70 font-medium tracking-tight hover:text-white hover:border-white/20 transition-colors w-full sm:w-auto"
                >
                  Read the manifesto
                </button>
              ) : (
                <a
                  href="/manifesto"
                  className="inline-flex items-center justify-center px-8 py-3 border border-white/10 text-white/70 font-medium tracking-tight hover:text-white hover:border-white/20 transition-colors w-full sm:w-auto"
                >
                  Read the manifesto
                </a>
              )}
            </div>
          </div>

          <div className="w-full max-w-lg lg:mt-12">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="text-[11px] sm:text-xs uppercase tracking-[0.3em] text-zinc-500">Example thread</div>
              <div className="space-y-5">
                {[
                  {
                    name: 'Ana Oliveira',
                    detail: 'Lisbon · wine bars',
                    note: 'Skipping the TimeOut market clones—going straight to Vino Vero tonight. Ask for the orange flight.',
                  },
                  {
                    name: 'Rahul Nair',
                    detail: 'Bali · surf',
                    note: "Jacob moved to dawn slots only. DM me before you book so he knows you're verified.",
                  },
                  {
                    name: 'Lina Ko',
                    detail: 'Berlin · clinics',
                    note: 'If you need a trauma-informed therapist, Dr. Maren still takes referrals from the Berlin Quiet group.',
                  },
                ].map((item) => (
                  <div key={item.name} className="border-t border-white/5 pt-5 first:border-t-0 first:pt-0">
                    <div className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-zinc-500 mb-2">{item.detail}</div>
                    <p className="text-base font-medium text-white mb-2">{item.name}</p>
                    <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">{item.note}</p>
                  </div>
                ))}
              </div>
              <div className="text-[11px] sm:text-xs text-zinc-600 uppercase tracking-[0.35em] pt-4 border-t border-white/5">
                Not for screenshots · Not for the open web
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

