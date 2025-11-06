import { Button } from "../ui/button";
import { ArrowRightIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function Hero() {
  const navigate = useNavigate();

  return (
    <section className="h-screen bg-white relative flex flex-col">
      <div className="absolute top-0 left-0 w-full h-4 bg-black"></div>
      <div className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-6 w-full">
          <div className="max-w-4xl mx-auto text-center">
            {/* Main Headline */}
            <div className="space-y-4 mb-8">
              <h1 className="text-5xl lg:text-6xl xl:text-7xl tracking-tight font-bold text-black">
                Stop trusting{" "}
                <span className="line-through text-gray-500">the internet</span>
              </h1>
              <h1 className="text-5xl lg:text-6xl xl:text-7xl tracking-tight font-bold text-black">
                Start trusting your network
              </h1>
            </div>

            {/* Subheading */}
            <p className="text-lg lg:text-xl text-gray-700 leading-relaxed max-w-2xl mx-auto mb-8 font-medium">
              Recce combines AI-powered semantic search with authentic recommendations from people you trust. 
              No more fake reviews. Just real experiences from your network.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="px-8 py-4 rounded-none border-2 border-black bg-black text-white hover:bg-gray-900 font-bold" onClick={() => navigate('/map')}>
                Join the Beta
                <ArrowRightIcon className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="px-8 py-4 rounded-none border-2 border-black bg-white text-black hover:bg-gray-50 font-bold">
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

