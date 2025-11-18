export function FinalCTA() {
  return (
    <section className="bg-black text-white py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-400">Last quiet corner on the internet</p>
          <h2 className="text-3xl sm:text-4xl font-medium tracking-tight leading-tight">
            Join the Rekky now, because we don't plan to ever go loud.
          </h2>
          <p className="text-lg text-zinc-300 leading-relaxed max-w-2xl">
            If you have people who actually move the needle
            on where you go, who you trust, and what you experience—bring them.
          </p>
        </div>
        {/* <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={onJoinClick}
            className="inline-flex items-center justify-center px-6 py-3 border border-white/20 bg-white/5 text-white font-medium tracking-tight hover:bg-white/10 hover:border-white/30 transition-colors"
          >
            Request access
          </button>
          <a
            href="mailto:hey@rekky.app"
            className="inline-flex items-center justify-center px-6 py-3 border border-white/10 text-white/70 font-medium tracking-tight hover:text-white hover:border-white/20 transition-colors"
          >
            Talk to the team
          </a>
        </div> */}
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500 pt-6 border-t border-white/10">
          No ads · No public profiles · No viral loops
        </p>
      </div>
    </section>
  );
}



