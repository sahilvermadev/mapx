const principles = [
  {
    title: 'Skin in the game',
    body: 'Reputation is the only moderation system that scales. Every rec is tied to someone who needs to look you in the eye next month.',
  },
  {
    title: 'Context over clicks',
    body: 'Rekky optimizes for “is this useful for you?” not for time-on-site. Context collapse is banned at the protocol level.',
  },
  {
    title: 'Fragility is real',
    body: 'The best things die when they trend. Controlled distribution is a survival mechanism, not nice-to-haves.',
  },
  {
    title: 'Small networks can win',
    body: 'Ten connections with real lived experience in a city can capture more value than a thousand anonymous reviews.',
  },
];

export function PrinciplesSection() {
  return (
    <section className="bg-white text-black py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Operating principles</p>
          <h2 className="text-3xl sm:text-4xl font-medium tracking-tight leading-tight">
            The rules that keep the private network intact.
          </h2>
          <p className="text-lg text-zinc-700 leading-relaxed">
            Everything about Rekky—product, AI, and community—exists to protect signal and punish noise.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {principles.map((principle) => (
            <div key={principle.title} className="border-t border-black pt-6 space-y-3">
              <h3 className="text-xl font-medium leading-tight">{principle.title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{principle.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}



