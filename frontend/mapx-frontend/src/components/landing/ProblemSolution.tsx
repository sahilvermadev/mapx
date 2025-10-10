export function ProblemSolution() {
  return (
    <section className="py-32 bg-white">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl tracking-tight mb-6">
            The current system is fundamentally broken
          </h2>
          <p className="text-xl text-muted-foreground">
            Generic review platforms are flooded with fake reviews, lack personal context, 
            and don't help you find places your trusted network actually recommends.
          </p>
        </div>

        {/* Problems & Solutions */}
        <div className="max-w-4xl mx-auto space-y-16">
          {/* Problem 1 */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl mb-4">30% of online reviews are fake</h3>
              <p className="text-muted-foreground leading-relaxed">
                Marketers and bots flood platforms with fake reviews, making it impossible to distinguish 
                between authentic experiences and paid promotion.
              </p>
            </div>
            <div className="bg-muted/50 p-8 rounded-lg">
              <div className="text-center">
                <div className="text-4xl mb-2">30%</div>
                <div className="text-sm text-muted-foreground">Fake reviews online</div>
              </div>
            </div>
          </div>

          {/* Solution 1 */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="md:order-2">
              <h3 className="text-2xl mb-4">100% authentic recommendations</h3>
              <p className="text-muted-foreground leading-relaxed">
                Recce only shows recommendations from people in your trusted network. 
                No anonymous reviews, no bots, no fake accounts.
              </p>
            </div>
            <div className="bg-muted/50 p-8 rounded-lg md:order-1">
              <div className="text-center">
                <div className="text-4xl mb-2">100%</div>
                <div className="text-sm text-muted-foreground">Authentic recommendations</div>
              </div>
            </div>
          </div>

          {/* Problem 2 */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl mb-4">Generic reviews lack context</h3>
              <p className="text-muted-foreground leading-relaxed">
                Current platforms can't understand nuanced queries like "quiet cafe for work" 
                or match recommendations to your specific taste and preferences.
              </p>
            </div>
            <div className="bg-muted/50 p-8 rounded-lg">
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Search: "Good restaurant"</div>
                <div className="text-xs bg-background p-2 rounded border">
                  😕 5,000 generic results
                </div>
              </div>
            </div>
          </div>

          {/* Solution 2 */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="md:order-2">
              <h3 className="text-2xl mb-4">AI understands natural language</h3>
              <p className="text-muted-foreground leading-relaxed">
                Ask questions naturally and get contextually relevant recommendations 
                from your network that match your specific needs.
              </p>
            </div>
            <div className="bg-muted/50 p-8 rounded-lg md:order-1">
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Search: "Quiet cafe for work"</div>
                <div className="text-xs bg-background p-2 rounded border">
                  ✅ 12 relevant recommendations from your network
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
