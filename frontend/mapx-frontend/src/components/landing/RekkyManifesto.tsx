export function RekkyManifesto() {
  return (
    <section className="bg-gradient-to-b from-zinc-950 via-black to-zinc-950 text-white pt-8 sm:pt-12 pb-16 sm:pb-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="space-y-4">
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            Over the years I have seen the internet turn from a miracle into a landfill.
          </p>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            Type “best restaurant in Lisbon” into Google and you drown in 400 sponsored listicles,
            40 TripAdvisor pages with suspiciously round numbers, and 8,000 SEO-optimized blog posts written
            by people who have probably never been within 2,000 km of Portugal. ChatGPT will confidently hallucinate
            a “hidden gem” that closed in 2019. The signal-to-noise ratio is effectively zero.
          </p>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            This is not a bug. It is the operating system of the open web: anyone can speak, therefore everyone
            shouts, therefore nothing can be heard.
          </p>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            The truly exceptional things—Jacob the surfing instructor who actually changes how you read waves,
            the hole-in-the-wall in Goa that makes sausage bread the way your grandmother wishes she could,
            the quiet therapist in Amsterdam who finally makes the noise stop—were never designed to win at SEO.
            They survive in whispers: a friend texts a friend, a cousin forwards a voice note, a colleague
            slips you an address “but don’t post it anywhere.”
          </p>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            That text message is still, in 2025, the highest-quality discovery engine on earth. Everything public has been gamed,
            drowned, or killed by its own popularity.
          </p>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            Rekky is the attempt to take that text-message moment and make it permanent, searchable, and shareable—without ever
            letting it leak into the open internet and get ruined.
          </p>
        </header>

        <div className="space-y-4">
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Why private recommendations beat the open web
          </h3>
          <ol className="list-decimal pl-6 space-y-4 text-lg sm:text-xl text-zinc-200 leading-relaxed">
            <li>
              <span className="font-semibold">Skin in the game.</span> When Rahul tells me Jacob is the best surf
              coach he’s ever had, Rahul’s reputation is on the line. He has to look me in the eye next month.
              Anonymous Google reviewers do not.
            </li>
            <li>
              <span className="font-semibold">Context collapse is impossible.</span> Rahul knows I’m an intermediate
              surfer who hates crowded lineups and learns better from quiet teachers. Google does not know any of that,
              and never will.
            </li>
            <li>
              <span className="font-semibold">The best things are fragile.</span> Once a place goes viral it is
              usually ruined in 12–18 months (see Sala in Bangkok, La Guerrerense in Ensenada, or any “secret” beach
              that ends up on Instagram). The only sustainable protection is controlled distribution.
            </li>
            <li>
              <span className="font-semibold">Curation compounds.</span> Ten trusted people who have lived in Goa for
              five years collectively know more than the entire open internet. Their private notes are worth more than
              a million public ones.
            </li>
          </ol>
        </div>

        <div className="space-y-4">
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Rekky as protected commons (not another public square)
          </h3>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            The open web is the classic tragedy of the commons. Rekky follows Elinor Ostrom’s insight that commons can endure when they stay small, with clear boundaries, mutual monitoring, and sanctions enforced by the participants themselves—in this case, reputation and the quiet threat of being dropped from the graph.<sup>1</sup>
          </p>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            The magic is therefore in everything Rekky refuses to do:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-lg sm:text-xl text-zinc-200 leading-relaxed">
            <li>No public profiles discoverable by strangers</li>
            <li>No algorithmic “trending” section that incentivizes virality</li>
            <li>No advertising, sponsored posts, or business-owner dashboard to bribe for visibility</li>
            <li>No export to the open web</li>
          </ul>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed font-semibold">Instead:</p>
          <ul className="list-disc pl-6 space-y-2 text-lg sm:text-xl text-zinc-200 leading-relaxed">
            <li>You can only see data created by people you explicitly follow or who are in groups you joined.</li>
            <li>You can only be found when someone already inside the graph invites you—and they are staking their reputation by doing it.</li>
            <li>Every recommendation lives in a vault you control: private by default, shareable only with chosen circles.</li>
            <li>The AI is trained exclusively on the private graph of you + your people. It never touches the open web.</li>
          </ul>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            This turns Rekky into a high-trust commons instead of another tragedy-of-the-commons platform.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            The flywheel that no open platform can copy
          </h3>
          <ol className="list-decimal pl-6 space-y-4 text-lg sm:text-xl text-zinc-200 leading-relaxed">
            <li>You discover something exceptional → you save it to your vault (because losing it again would be stupid).</li>
            <li>You optionally share it with one or more circles (friends, family, “Berlin expats”, etc.).</li>
            <li>Your friends see it, try it, and add their own signal (“Jacob is great but only does mornings now”).</li>
            <li>The graph gets denser and higher quality.</li>
            <li>The AI gets smarter at mapping taste clusters inside your network.</li>
            <li>
              Next time you land in Lisbon, the app doesn’t give you “top 10” listicles—it says “Your friend Ana (whose food
              taste overlaps with yours 87%) saved two places you’ll probably love, and one to skip.”
            </li>
          </ol>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            This flywheel only works when participation cannot destroy the resource (i.e., when virality is impossible).
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Objections I have to take seriously
          </h3>
          <ol className="list-decimal pl-6 space-y-4 text-lg sm:text-xl text-zinc-200 leading-relaxed">
            <li>
              “Network effects—how do you ever get critical mass if it’s closed?” Critical mass is smaller than people
              think. If 300 of my real contacts are active, I already have better recommendations than the entire open internet.
              WhatsApp grew to billions with zero discoverability.
            </li>
            <li>
              “What if my friends have boring taste?” Bourdieu spent his life showing that cultural distinction is produced exactly inside small, homophilous groups—people who already share taste naturally find each other and reinforce it.<sup>2</sup> Rekky simply accelerates that process instead of fighting it with forced “diversity.”
            </li>
            <li>
              “People are lazy—they won’t save things.” People already save things religiously: screenshots, Google Maps stars,
              Notes app, voice notes. Rekky just gives them one obvious bucket instead of twelve.
            </li>
            <li>
              “This is just another echo chamber.” Possibly. But an echo chamber of ten food-obsessed friends who argue about
              biryani is infinitely more useful than the current cacophony of 10,000 strangers who mostly want free dessert for
              a five-star review.
            </li>
          </ol>
        </div>

        <div className="space-y-4">
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">The deeper claim</h3>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            The internet’s original sin was assuming that more speech automatically equals better speech. We now know that is false.
          </p>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            Some kinds of knowledge—like who to trust with your backhand or your mental health, or where to eat on your one night
            in town—are not improved by scale. Like Ostrom’s successfully governed commons, they thrive only under clear boundaries,
            mutual monitoring, and sanctions enforced by the participants themselves.<sup>1</sup> They are improved by filtration, reputation,
            and shared context—what Bourdieu would recognise as a field of restricted cultural production.<sup>2</sup>
          </p>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            Rekky is the bet that a small, protected, high-signal graph of real human relationships will beat the entire open web
            at the only thing that still matters: helping you find the exceptional without wrecking it in the process.
          </p>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed">
            If that bet is right (and everything I’ve seen in fifteen years of watching the internet eat itself alive suggests it is),
            then yes—Rekky doesn’t just have a place on the internet.
          </p>
          <p className="text-lg sm:text-xl text-zinc-200 leading-relaxed font-semibold">
            It might be one of the last places left where the internet still works.
          </p>
        </div>

        {/* Footnotes */}
        <footer className="pt-12 border-t border-zinc-800 text-sm text-zinc-400 space-y-2">
          <p>
            <sup>1</sup> Elinor Ostrom, <cite>Governing the Commons: The Evolution of Institutions for Collective Action</cite> (Cambridge University Press, 1990).
          </p>
          <p>
            <sup>2</sup> Pierre Bourdieu, <cite>Distinction: A Social Critique of the Judgement of Taste</cite>, trans. Richard Nice (Harvard University Press, 1984; orig. French 1979).
          </p>
        </footer>
      </div>
    </section>
  );
}