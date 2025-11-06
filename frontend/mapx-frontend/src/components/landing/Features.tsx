import { SearchIcon, UsersIcon, MessageSquareIcon } from "lucide-react";

export function Features() {
  return (
    <section id="features" className="min-h-screen bg-gray-100 flex flex-col">
      <div className="flex-1 flex items-center justify-center min-h-0 py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 w-full py-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8 lg:mb-12 px-2">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight mb-3 sm:mb-4 font-bold text-black break-words">
              How Recce works
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-700 font-medium break-words">
              AI-powered discovery meets authentic social connections. 
              Ask questions or search recommendations from your trusted network.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 xl:gap-12 max-w-5xl mx-auto">
          <div className="text-center space-y-3 sm:space-y-4 lg:space-y-6 px-2">
            <div className="w-12 h-12 lg:w-16 lg:h-16 mx-auto bg-black border-4 border-black flex items-center justify-center">
              <SearchIcon className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl mb-2 lg:mb-3 font-bold text-black break-words">AI semantic search</h3>
              <p className="text-xs sm:text-sm lg:text-base text-gray-700 leading-relaxed break-words">
                Search naturally in the map or feed. Ask "quiet cafe for work" or "romantic dinner under ₹2000". 
                AI finds relevant recommendations and questions from your network.
              </p>
            </div>
            <div className="bg-white border-4 border-black p-3 sm:p-4 lg:p-5 text-left">
              <div className="text-xs lg:text-sm font-medium text-gray-700 mb-2">Search finds:</div>
              <div className="space-y-1">
                <div className="text-xs lg:text-sm font-medium text-black break-words">📍 Recommendations from your network</div>
                <div className="text-xs lg:text-sm font-medium text-black break-words">❓ Related questions people asked</div>
                <div className="text-xs lg:text-sm font-medium text-black break-words">🗺️ Places on the map</div>
              </div>
            </div>
          </div>

          <div className="text-center space-y-3 sm:space-y-4 lg:space-y-6 px-2">
            <div className="w-12 h-12 lg:w-16 lg:h-16 mx-auto bg-black border-4 border-black flex items-center justify-center">
              <UsersIcon className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl mb-2 lg:mb-3 font-bold text-black break-words">Follow & groups</h3>
              <p className="text-xs sm:text-sm lg:text-base text-gray-700 leading-relaxed break-words">
                Follow friends whose taste you trust. Create friend groups (Foodie friends, Work colleagues) 
                and filter recommendations by group. See recommendations on a map from people you follow.
              </p>
            </div>
            <div className="bg-white border-4 border-black p-3 sm:p-4 lg:p-5 text-left">
              <div className="text-xs lg:text-sm font-medium text-gray-700 mb-2">Your feed shows:</div>
              <div className="space-y-1">
                <div className="text-xs lg:text-sm font-medium text-black break-words">✨ Recommendations from people you follow</div>
                <div className="text-xs lg:text-sm font-medium text-black break-words">💬 Questions from your network</div>
                <div className="text-xs lg:text-sm font-medium text-black break-words">🔍 Filter by friend groups or city</div>
              </div>
            </div>
          </div>

          <div className="text-center space-y-3 sm:space-y-4 lg:space-y-6 px-2">
            <div className="w-12 h-12 lg:w-16 lg:h-16 mx-auto bg-black border-4 border-black flex items-center justify-center">
              <MessageSquareIcon className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl mb-2 lg:mb-3 font-bold text-black break-words">Ask & share</h3>
              <p className="text-xs sm:text-sm lg:text-base text-gray-700 leading-relaxed break-words">
                Ask questions to your network: "Best place for a first date?" Friends answer with recommendations. 
                Share your own discoveries with ratings, tags, and notes. View everything on an interactive map.
              </p>
            </div>
            <div className="bg-white border-4 border-black p-3 sm:p-4 lg:p-5 text-left">
              <div className="text-xs lg:text-sm font-medium text-gray-700 mb-2">Create recommendations:</div>
              <div className="space-y-1">
                <div className="text-xs lg:text-sm font-medium text-black break-words">⭐ Rate places (1-5 stars)</div>
                <div className="text-xs lg:text-sm font-medium text-black break-words">🏷️ Add tags & labels</div>
                <div className="text-xs lg:text-sm font-medium text-black break-words">👥 Share with friends or groups</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

