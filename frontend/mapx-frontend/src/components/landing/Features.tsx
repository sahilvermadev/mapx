import { SearchIcon, UsersIcon, ShieldIcon } from "lucide-react";

export function Features() {
  return (
    <section id="features" className="py-32 bg-gray-100">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl tracking-tight mb-6">
            How Recce works
          </h2>
          <p className="text-xl text-muted-foreground">
            AI-powered discovery meets authentic social connections. 
            Get recommendations that actually match your taste from people you trust.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
          <div className="text-center space-y-6">
            <div className="w-12 h-12 mx-auto bg-background border rounded-lg flex items-center justify-center">
              <SearchIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl mb-3">AI-powered search</h3>
              <p className="text-muted-foreground leading-relaxed">
                Ask questions naturally: "Best quiet cafe for work in Hauz Khas". 
                Our AI understands context and finds exactly what you need.
              </p>
            </div>
            <div className="bg-background border rounded-lg p-4 text-left">
              <div className="text-sm text-muted-foreground mb-2">Example query:</div>
              <div className="text-sm mb-2">"Romantic dinner under ₹2000"</div>
              <div className="text-xs text-muted-foreground">
                AI considers: ambiance, price, cuisine, setting
              </div>
            </div>
          </div>

          <div className="text-center space-y-6">
            <div className="w-12 h-12 mx-auto bg-background border rounded-lg flex items-center justify-center">
              <UsersIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl mb-3">Trusted network</h3>
              <p className="text-muted-foreground leading-relaxed">
                Build your network of trusted reviewers. Create friend groups 
                and get recommendations from people whose taste you trust.
              </p>
            </div>
            <div className="bg-background border rounded-lg p-4 text-left">
              <div className="text-sm text-muted-foreground mb-2">Your network:</div>
              <div className="space-y-1">
                <div className="text-sm">Sarah Chen • Foodie friends</div>
                <div className="text-sm">Alex Kumar • Work colleagues</div>
                <div className="text-sm">Maya Singh • Family</div>
              </div>
            </div>
          </div>

          <div className="text-center space-y-6">
            <div className="w-12 h-12 mx-auto bg-background border rounded-lg flex items-center justify-center">
              <ShieldIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl mb-3">Privacy first</h3>
              <p className="text-muted-foreground leading-relaxed">
                Control who sees your recommendations. Share with specific groups, 
                keep them private, or make them public. You decide.
              </p>
            </div>
            <div className="bg-background border rounded-lg p-4 text-left">
              <div className="text-sm text-muted-foreground mb-2">Sharing options:</div>
              <div className="space-y-1">
                <div className="text-sm">🔒 Private</div>
                <div className="text-sm">👥 Friend groups</div>
                <div className="text-sm">🌍 Public</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
