export function SocialProof() {
  const testimonials = [
    {
      name: "Priya Sharma",
      role: "Food Blogger",
      content: "Finally! A platform where I can trust the recommendations. No more wading through fake reviews. When my foodie friends recommend a place on Recce, I know it's going to be good."
    },
    {
      name: "Arjun Patel",
      role: "Software Engineer",
      content: "The AI search is incredible. I asked for 'quiet cafes with good WiFi for coding' and got exactly what I needed. All recommendations were from people whose taste I trust."
    },
    {
      name: "Maya Singh",
      role: "Marketing Manager", 
      content: "Love how I can share recommendations with specific friend groups. I share work-friendly spots with colleagues and date spots with close friends. The privacy controls are perfect."
    }
  ];

  return (
    <section id="testimonials" className="py-32 bg-gray-100">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl tracking-tight mb-6">
            Loved by early users
          </h2>
          <p className="text-xl text-muted-foreground">
            Join thousands of users who've discovered their new favorite places 
            through authentic recommendations from people they trust.
          </p>
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-background border rounded-lg p-6">
              <p className="text-muted-foreground mb-6 leading-relaxed">{testimonial.content}</p>
              <div>
                <div className="font-medium">{testimonial.name}</div>
                <div className="text-sm text-muted-foreground">{testimonial.role}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="text-3xl font-semibold mb-2">2,000+</div>
            <div className="text-sm text-muted-foreground">Beta users</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-semibold mb-2">15,000+</div>
            <div className="text-sm text-muted-foreground">Recommendations</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-semibold mb-2">98%</div>
            <div className="text-sm text-muted-foreground">Satisfaction</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-semibold mb-2">5</div>
            <div className="text-sm text-muted-foreground">Cities</div>
          </div>
        </div>
      </div>
    </section>
  );
}
