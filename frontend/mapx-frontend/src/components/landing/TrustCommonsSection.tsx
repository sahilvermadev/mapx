const pillars = [
  {
    title: 'Vault-first architecture',
    body: 'Every recommendation lives in a private vault you control. Circles decide what is visible, for how long, and to whom.',
    tag: 'Private by default',
  },
  {
    title: 'Invite-only graph',
    body: 'There is no global feed. You can only be discovered by people who are already trusted nodes. No growth hacks, just real networks.',
    tag: 'Anti-virality',
  },
  {
    title: 'Taste-aware AI',
    body: 'Models train solely on the private graph of you + your people. No scraping, no public data, no contamination from the landfill web.',
    tag: 'Sealed intelligence',
  },
];

export function TrustCommonsSection() {
  return (
    <section className="bg-zinc-50 text-black py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Protected commons</p>
          <h2 className="text-3xl sm:text-4xl font-medium tracking-tight leading-tight">We refuse to become another public square.</h2>
          <p className="text-lg text-zinc-700 leading-relaxed">
            Rekky flips every incentive that ruined the open web. No ads, no algorithmic trending, no incentive to go viral.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="space-y-3">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">{pillar.tag}</div>
              <h3 className="text-xl font-medium leading-relaxed">{pillar.title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{pillar.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}



