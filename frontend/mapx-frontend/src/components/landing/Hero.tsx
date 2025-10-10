import { Button } from "../ui/button";
import { ArrowRightIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function Hero() {
  const navigate = useNavigate();

  return (
    <section className="min-h-screen bg-white">
      <div className="container mx-auto px-6 pt-32 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main Headline */}
          <div className="space-y-6 mb-12">
            <h1 className="text-6xl lg:text-7xl tracking-tight">
              Stop trusting{" "}
              <span className="line-through text-muted-foreground">fake reviews</span>
            </h1>
            <h1 className="text-6xl lg:text-7xl tracking-tight">
              Start trusting your network
            </h1>
          </div>

          {/* Subheading */}
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-12">
            Recce combines AI-powered semantic search with authentic recommendations from people you trust. 
            No more fake reviews. Just real experiences from your network.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button size="lg" className="px-8 py-4 rounded-lg" onClick={() => navigate('/map')}>
              Join the Beta
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="px-8 py-4 rounded-lg">
              Watch Demo
            </Button>
          </div>

          {/* Simple Stats */}
          {/* <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto pt-8 border-t border-border">
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">2,000+</div>
              <div className="text-sm text-muted-foreground">Beta users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">15,000+</div>
              <div className="text-sm text-muted-foreground">Recommendations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">5</div>
              <div className="text-sm text-muted-foreground">Cities</div>
            </div>
          </div> */}
        </div>
      </div>
    </section>
  );
}
