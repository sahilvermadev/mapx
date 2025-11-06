export function ProblemSolution() {
  return (
    <section className="h-screen bg-white flex flex-col overflow-y-auto">
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="container mx-auto px-6 w-full py-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-8">
            <h2 className="text-3xl lg:text-4xl tracking-tight mb-4 font-bold text-black">
              The current system is fundamentally broken
            </h2>
            <p className="text-lg lg:text-xl text-gray-700 font-medium">
              Generic review platforms are flooded with fake reviews, lack personal context, 
              and don't help you find places your trusted network actually recommends.
            </p>
          </div>

          {/* Problems & Solutions */}
          <div className="max-w-4xl mx-auto space-y-8">
          {/* Problem 1 */}
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 items-center">
            <div>
              <h3 className="text-xl lg:text-2xl mb-3 font-bold text-black">30% of online reviews are fake</h3>
              <p className="text-sm lg:text-base text-gray-700 leading-relaxed">
                Marketers and bots flood platforms with fake reviews, making it impossible to distinguish 
                between authentic experiences and paid promotion.
              </p>
            </div>
            <div className="bg-gray-100 p-6 lg:p-8 border-4 border-black">
              <div className="text-center">
                <div className="text-3xl lg:text-4xl mb-2 font-bold text-black">30%</div>
                <div className="text-xs lg:text-sm font-medium text-gray-700">Fake reviews online</div>
              </div>
            </div>
          </div>

          {/* Solution 1 */}
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 items-center">
            <div className="md:order-2">
              <h3 className="text-xl lg:text-2xl mb-3 font-bold text-black">100% authentic recommendations</h3>
              <p className="text-sm lg:text-base text-gray-700 leading-relaxed">
                Recce only shows recommendations from people in your trusted network. 
                No anonymous reviews, no bots, no fake accounts.
              </p>
            </div>
            <div className="bg-black text-white p-6 lg:p-8 border-4 border-black md:order-1">
              <div className="text-center">
                <div className="text-3xl lg:text-4xl mb-2 font-bold text-white">100%</div>
                <div className="text-xs lg:text-sm font-medium text-white">Authentic recommendations</div>
              </div>
            </div>
          </div>

          {/* Problem 2 */}
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 items-center">
            <div>
              <h3 className="text-xl lg:text-2xl mb-3 font-bold text-black">Generic reviews lack context</h3>
              <p className="text-sm lg:text-base text-gray-700 leading-relaxed">
                Current platforms can't understand nuanced queries like "quiet cafe for work" 
                or match recommendations to your specific taste and preferences.
              </p>
            </div>
            <div className="bg-gray-100 p-6 lg:p-8 border-4 border-black">
              <div className="space-y-2">
                <div className="text-xs lg:text-sm font-medium text-gray-700">Search: "Good restaurant"</div>
                <div className="text-xs bg-white p-2 lg:p-3 border-2 border-black text-black font-medium">
                  😕 5,000 generic results
                </div>
              </div>
            </div>
          </div>

          {/* Solution 2 */}
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 items-center">
            <div className="md:order-2">
              <h3 className="text-xl lg:text-2xl mb-3 font-bold text-black">AI understands natural language</h3>
              <p className="text-sm lg:text-base text-gray-700 leading-relaxed">
                Ask questions naturally and get contextually relevant recommendations 
                from your network that match your specific needs.
              </p>
            </div>
            <div className="bg-black text-white p-6 lg:p-8 border-4 border-black md:order-1">
              <div className="space-y-2">
                <div className="text-xs lg:text-sm font-medium text-white">Search: "Quiet cafe for work"</div>
                <div className="text-xs bg-white p-2 lg:p-3 border-2 border-white text-black font-medium">
                  ✅ 12 relevant recommendations from your network
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}


