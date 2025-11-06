export function Hero() {

  return (
    <section className="min-h-screen bg-white relative flex flex-col">
      <div className="absolute top-0 left-0 w-full h-4 bg-black"></div>
      <div className="flex-1 flex items-center justify-center py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 w-full">
          <div className="max-w-4xl mx-auto text-center">
            {/* Main Headline */}
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl tracking-tight font-bold text-black break-words">
                Stop trusting{" "}
                <span className="line-through text-gray-500">the internet</span>
              </h1>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl tracking-tight font-bold text-black break-words">
                Start trusting your network
              </h1>
            </div>

            {/* Subheading */}
            <p className="text-base sm:text-lg lg:text-xl text-gray-700 leading-relaxed max-w-2xl mx-auto font-medium px-2 break-words">
              Recce combines AI-powered semantic search with authentic recommendations from people you trust. 
              No more fake reviews. Just real experiences from your network.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

