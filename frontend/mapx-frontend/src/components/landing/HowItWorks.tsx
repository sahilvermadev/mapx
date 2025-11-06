import { UserPlusIcon, SearchIcon, ShareIcon } from "lucide-react";
import { Button } from "../ui/button";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex items-center justify-center min-h-0 py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 w-full py-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-8 lg:mb-12 px-2">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight mb-3 sm:mb-4 font-bold text-black break-words">
              Get started in 3 steps
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-700 font-medium break-words">
              Join a community of authentic reviewers and start discovering amazing places 
              through people you trust.
            </p>
          </div>

          {/* Steps */}
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6 sm:gap-8 lg:gap-12 mb-8 lg:mb-12">
              {/* Step 1 */}
              <div className="text-center px-2">
                <div className="w-12 h-12 lg:w-16 lg:h-16 bg-black border-4 border-black flex items-center justify-center mx-auto mb-4 lg:mb-6">
                  <UserPlusIcon className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
                </div>
                <h3 className="text-base sm:text-lg lg:text-xl mb-2 sm:mb-3 font-bold text-black break-words">1. Build your network</h3>
                <p className="text-xs sm:text-sm lg:text-base text-gray-700 leading-relaxed break-words">
                  Connect with friends, colleagues, and food enthusiasts whose taste you trust. 
                  Create specific groups for different interests.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center px-2">
                <div className="w-12 h-12 lg:w-16 lg:h-16 bg-black border-4 border-black flex items-center justify-center mx-auto mb-4 lg:mb-6">
                  <SearchIcon className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
                </div>
                <h3 className="text-base sm:text-lg lg:text-xl mb-2 sm:mb-3 font-bold text-black break-words">2. Ask & discover</h3>
                <p className="text-xs sm:text-sm lg:text-base text-gray-700 leading-relaxed break-words">
                  Use natural language to search for exactly what you need. 
                  Our AI finds relevant recommendations from your trusted network.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center px-2">
                <div className="w-12 h-12 lg:w-16 lg:h-16 bg-black border-4 border-black flex items-center justify-center mx-auto mb-4 lg:mb-6">
                  <ShareIcon className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
                </div>
                <h3 className="text-base sm:text-lg lg:text-xl mb-2 sm:mb-3 font-bold text-black break-words">3. Share & help</h3>
                <p className="text-xs sm:text-sm lg:text-base text-gray-700 leading-relaxed break-words">
                  Share your own discoveries with your network. 
                  Help others find great places while building a trusted community.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center p-4 sm:p-6 lg:p-12 border-4 border-black bg-gray-50 mx-2 sm:mx-0">
              <h3 className="text-lg sm:text-xl lg:text-2xl mb-2 sm:mb-3 lg:mb-4 font-bold text-black break-words">Ready to start?</h3>
              <p className="text-xs sm:text-sm lg:text-base text-gray-700 max-w-md mx-auto mb-4 sm:mb-6 lg:mb-8 font-medium px-2 break-words">
                Join thousands of users who've already discovered their new favorite places through trusted recommendations.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" variant="outline" className="rounded-none border-2 border-black bg-white text-black hover:bg-gray-50 font-bold">Learn More</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


