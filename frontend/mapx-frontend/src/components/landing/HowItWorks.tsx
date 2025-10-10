import { UserPlusIcon, SearchIcon, ShareIcon } from "lucide-react";
import { Button } from "../ui/button";
import { useNavigate } from "react-router-dom";

export function HowItWorks() {
  const navigate = useNavigate();
  return (
    <section id="how-it-works" className="py-32 bg-white">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl tracking-tight mb-6">
            Get started in 3 steps
          </h2>
          <p className="text-xl text-muted-foreground">
            Join a community of authentic reviewers and start discovering amazing places 
            through people you trust.
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-16">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-foreground text-background rounded-lg flex items-center justify-center mx-auto mb-6">
                <UserPlusIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl mb-4">1. Build your network</h3>
              <p className="text-muted-foreground leading-relaxed">
                Connect with friends, colleagues, and food enthusiasts whose taste you trust. 
                Create specific groups for different interests.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-foreground text-background rounded-lg flex items-center justify-center mx-auto mb-6">
                <SearchIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl mb-4">2. Ask & discover</h3>
              <p className="text-muted-foreground leading-relaxed">
                Use natural language to search for exactly what you need. 
                Our AI finds relevant recommendations from your trusted network.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-foreground text-background rounded-lg flex items-center justify-center mx-auto mb-6">
                <ShareIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl mb-4">3. Share & help</h3>
              <p className="text-muted-foreground leading-relaxed">
                Share your own discoveries with your network. 
                Help others find great places while building a trusted community.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-20 p-12 border rounded-lg">
            <h3 className="text-2xl mb-4">Ready to start?</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Join thousands of users who've already discovered their new favorite places through trusted recommendations.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={() => navigate('/map')}>Join the Beta</Button>
              <Button size="lg" variant="outline">Learn More</Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
