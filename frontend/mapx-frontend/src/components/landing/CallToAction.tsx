import { Button } from "../ui/button";
import { ArrowRightIcon } from "lucide-react";

export function CallToAction() {
  return (
    <section className="h-screen bg-black text-white border-t-4 border-white flex flex-col">
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="container mx-auto px-6 w-full py-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl lg:text-5xl xl:text-6xl tracking-tight mb-4 lg:mb-6 font-bold text-white">
              Ready to discover your next favorite place?
            </h2>

            <p className="text-lg lg:text-xl text-gray-200 mb-6 lg:mb-8 max-w-2xl mx-auto font-medium">
              Join the waitlist for early access to Rekky. Be among the first to experience 
              AI-powered local discovery through your trusted network.
            </p>

            {/* Sign-up Form */}
            <div className="bg-white border-4 border-white p-6 lg:p-8 max-w-lg mx-auto mb-6 lg:mb-8">
              <form className="space-y-4">
                <input 
                  type="email" 
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 bg-white border-2 border-black text-black placeholder-gray-500 focus:outline-none focus:border-black font-medium"
                />
                
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full py-3 rounded-none border-2 border-black bg-black text-white hover:bg-gray-900 font-bold"
                >
                  Join the Waitlist
                  <ArrowRightIcon className="w-4 h-4 ml-2" />
                </Button>
              </form>

              <p className="text-xs text-gray-400 mt-4 text-center font-medium">
                We respect your privacy. No spam, just product updates and early access.
              </p>
            </div>

            {/* Secondary Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="ghost" size="lg" className="text-white hover:bg-white hover:text-black font-bold border-2 border-white rounded-none">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


