import { Link } from 'react-router-dom';

export function ManifestoPreviewSection() {
  return (
    <section className="bg-black text-white py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto border border-white/15 bg-white/5 rounded-2xl p-6 sm:p-10 space-y-8">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Imagine</p>
          <h2 className="text-3xl sm:text-4xl font-medium tracking-tight leading-tight">
            Sharing the best thing you found without exposing it to the world.
          </h2>
        </div>

        <div className="space-y-4 text-base sm:text-lg text-zinc-200 leading-relaxed">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Scene</p>
            <p className="text-lg">You’re in Goa.</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">What you see</p>
            <p>
            Rekky instantly shows you the little shack on Vagator cliff your friend saved last monsoon 
            — still ₹180 for the best prawn curry rice on the coast, still no DJ, still no loud tourists.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Why it survived</p>
            <p>Because nobody outside your circle can see it. Because it never touched the open web.</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">How Rekky works</p>
            <p>You save the thing once, share it with exactly who you trust, and it survives.</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Promise</p>
            <p>We built Rekky so that the best things stop dying the day they get discovered.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-white/10 pt-6">
          <p className="text-sm text-white/70">
            Curious how we’re building this? We wrote a short note on the philosophy behind Rekky.
          </p>
          <Link
            to="/manifesto"
            className="inline-flex items-center gap-2 text-sm font-medium tracking-tight text-white/90 hover:text-white transition"
          >
            → Read the 8-minute manifesto
          </Link>
        </div>
      </div>
    </section>
  );
}



