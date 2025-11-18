const steps = [
  {
    number: '01',
    title: 'Capture the exceptional',
    body: 'You save the places, people, and services that actually move you—because forgetting them would be a crime.',
  },
  {
    number: '02',
    title: 'Share with intention',
    body: 'You choose the circles—friends, crews, work pods, expat groups. Nothing leaks beyond who you pick.',
  },
  {
    number: '03',
    title: 'Context compounds',
    body: 'Your people add annotations, photos, and constraints (“only book lunches” or “great if you speak Spanish”).',
  },
  {
    number: '04',
    title: 'Graph densifies',
    body: 'The private network begins to understand who trusts whom, and where taste genuinely overlaps.',
  },
  {
    number: '05',
    title: 'AI narrows taste',
    body: 'Models map micro-clusters (“quiet therapists in Amsterdam” vs “loud dinner parties in Bangkok).',
  },
  {
    number: '06',
    title: 'Discovery without chaos',
    body: 'When you land in Lisbon, you get a friend\'s two new saves and which one to skip—not a generic travel article.',
  },
];

export function FlywheelSection() {
  return (
    <section className="bg-black text-white py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-400">The Rekky flywheel</p>
          <h2 className="text-3xl sm:text-4xl font-medium tracking-tight leading-tight">
            Engagement doesn't expose the prize.
          </h2>
          <p className="text-lg text-zinc-300 leading-relaxed">
            Each interaction strengthens the graph without exposing it.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {steps.map((step) => (
            <div key={step.number} className="border-t border-white/10 pt-6 space-y-3">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">{step.number}</div>
              <h3 className="text-xl font-medium leading-tight">{step.title}</h3>
              <p className="text-sm text-zinc-300 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}



