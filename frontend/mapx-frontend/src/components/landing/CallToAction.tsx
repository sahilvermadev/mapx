import { Button } from "../ui/button";
import { ArrowRightIcon } from "lucide-react";

export function CallToAction() {
  return (
    <section className="py-32 bg-foreground text-background">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-5xl lg:text-6xl tracking-tight mb-6">
            Ready to discover your next favorite place?
          </h2>

          <p className="text-xl text-background/70 mb-12 max-w-2xl mx-auto">
            Join the waitlist for early access to Recce. Be among the first to experience 
            AI-powered local discovery through your trusted network.
          </p>

          {/* Sign-up Form */}
          <div className="bg-background/10 border border-background/20 p-8 rounded-lg max-w-lg mx-auto mb-8">
            <form className="space-y-4">
              <input 
                type="email" 
                placeholder="Enter your email"
                className="w-full px-4 py-3 bg-background/20 border border-background/30 rounded-lg text-background placeholder-background/50 focus:outline-none focus:ring-2 focus:ring-background/50"
              />
              
              <Button 
                type="submit" 
                size="lg" 
                variant="secondary"
                className="w-full py-3"
              >
                Join the Waitlist
                <ArrowRightIcon className="w-4 h-4 ml-2" />
              </Button>
            </form>

            <p className="text-xs text-background/50 mt-4 text-center">
              We respect your privacy. No spam, just product updates and early access.
            </p>
          </div>

          {/* Secondary Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="ghost" size="lg" className="text-white hover:bg-white hover:text-black">
              Watch Demo
            </Button>
            <Button variant="ghost" size="lg" className="text-white hover:bg-white hover:text-black">
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
