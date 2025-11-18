export function SignalNoiseSection() {
  return (
    <section className="bg-white text-black py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">The open web is maxed out</p>
          <h2 className="text-3xl sm:text-4xl font-medium tracking-tight leading-tight">
            Noise is a feature of the web, not a bug.
          </h2>
          <p className="text-lg text-zinc-700 leading-relaxed">
            Reviews, rankings, and "top 10" listicles are designed to reward whoever shouts the loudest.
            Rekky starts from the opposite assumption: the good stuff hides on purpose.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="border-t border-black pt-6 space-y-5">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Open web reality</div>
            <h3 className="text-2xl font-medium leading-tight">"Best restaurant in Lisbon"</h3>
            <ul className="space-y-2 text-sm text-zinc-700 leading-relaxed">
              <li>· 400 sponsored listicles</li>
              <li>· 40 TripAdvisor clones with identical "top reviewers"</li>
              <li>· AI hallucinations about places that closed in 2019</li>
              <li>· Zero context about who is recommending what</li>
            </ul>
            <div className="text-xs uppercase tracking-[0.3em] text-red-600 pt-4 border-t border-zinc-200">Signal-to-noise: 0%</div>
          </div>

          <div className="border-t border-black bg-black text-white pt-6 p-6 space-y-5">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">Private recommendation reality</div>
            <h3 className="text-2xl font-medium leading-tight">"Where does Ana eat in Lisbon?"</h3>
            <ul className="space-y-2 text-sm text-zinc-200 leading-relaxed">
              <li>· Context: you like natural wine and small rooms</li>
              <li>· Source: Ana translated half the menus in Chiado</li>
              <li>· Integrity: her reputation is on the line next week</li>
              <li>· Protection: no virality, no public discoverability</li>
            </ul>
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-400 pt-4 border-t border-white/10">Signal-to-noise: 100%</div>
          </div>
        </div>
      </div>
    </section>
  );
}



