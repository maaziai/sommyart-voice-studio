import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Mic, Split, Sparkles, Zap, Users, Volume2, ArrowRight, Play, Star, CheckCircle } from "lucide-react";
import sommyartLogo from "@/assets/sommyart-logo.jpg";
import heroImage from "@/assets/hero-studio.jpg";
import landingBg from "@/assets/landing-bg.jpg";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Faded Background Image */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${landingBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-background/85" />
      </div>

      {/* Animated Background Overlays */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={sommyartLogo} alt="Sommyart Labs" className="w-10 h-10 rounded-xl shadow-lg" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Sommyart Labs
            </span>
          </div>
          <Link to="/studio">
            <Button variant="studio" className="shadow-lg">
              <Mic className="w-4 h-4" />
              Try Free
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary font-medium animate-fade-in">
            <Sparkles className="w-4 h-4" />
            Powered by Google Gemini 2.5 Flash TTS
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold leading-tight">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient">
              Turn Text Into
            </span>
            <br />
            <span className="text-foreground">
              Studio-Quality Voice
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Create professional AI voiceovers in seconds. Perfect for podcasts, videos, 
            audiobooks, and storytelling with our revolutionary <span className="text-primary font-semibold">Split Voice</span> technology.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/studio">
              <Button variant="studio" size="lg" className="text-lg px-8 py-6 shadow-xl hover:scale-105 transition-transform">
                <Play className="w-5 h-5" />
                Start Creating Free
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-green-500" />
              No credit card required
            </div>
          </div>

          {/* Hero Visual */}
          <div className="relative mt-12 mx-auto max-w-4xl">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-accent/30 rounded-3xl blur-xl transform scale-105" />
            <Card className="relative p-2 bg-card/80 backdrop-blur-lg border-border/50 rounded-3xl shadow-2xl overflow-hidden">
              <img 
                src={heroImage} 
                alt="AI Voice Studio" 
                className="w-full rounded-2xl opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent rounded-2xl" />
              <div className="absolute bottom-8 left-8 right-8">
                <div className="flex items-center gap-4 p-4 bg-card/90 backdrop-blur-md rounded-2xl border border-border/50 shadow-lg">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                    <Volume2 className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-primary/30 rounded-full overflow-hidden">
                      <div className="h-full w-2/3 bg-gradient-to-r from-primary to-accent rounded-full animate-[pulse_2s_ease-in-out_infinite]" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Generating natural voice...</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Split Voice Feature - Main Highlight */}
      <section className="relative z-10 py-24 bg-gradient-to-b from-background via-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-full text-sm text-accent font-medium mb-6">
                <Star className="w-4 h-4" />
                Featured Technology
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Revolutionary <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Split Voice</span> Mode
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Create dynamic dialogues with multiple characters using simple tags. 
                Perfect for stories, podcasts, and dramatic content.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Code Example */}
              <Card className="p-6 bg-card/50 backdrop-blur border-border/50 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Split className="w-5 h-5 text-primary icon-3d" />
                  <span className="text-sm font-semibold text-foreground">Your Script</span>
                </div>
                <div className="font-mono text-sm space-y-3 p-4 bg-muted/30 rounded-xl border border-border/30">
                  <p><span className="text-primary font-bold">[MALE]</span> Welcome to our podcast!</p>
                  <p><span className="text-accent font-bold">[FEMALE]</span> <span className="text-muted-foreground">[giggles]</span> So excited to be here.</p>
                  <p><span className="text-primary font-bold">[MALE]</span> <span className="text-muted-foreground">[pause]</span> Let's dive into today's topic.</p>
                  <p><span className="text-accent font-bold">[FEMALE]</span> I've been waiting for this one!</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Supports expressive actions: [pause], [giggles], [sigh], and more
                </div>
              </Card>

              {/* Benefits */}
              <div className="space-y-6">
                <div className="flex gap-4 p-4 bg-card/30 rounded-xl border border-border/30 hover:border-primary/50 transition-colors">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Multiple Characters</h3>
                    <p className="text-sm text-muted-foreground">Assign different voices to male and female characters with a simple tag system.</p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-card/30 rounded-xl border border-border/30 hover:border-primary/50 transition-colors">
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Expressive Actions</h3>
                    <p className="text-sm text-muted-foreground">Add [pause], [giggles], [sigh] and more to create natural, expressive dialogue.</p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-card/30 rounded-xl border border-border/30 hover:border-primary/50 transition-colors">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Instant Results</h3>
                    <p className="text-sm text-muted-foreground">Generate complete dialogues in seconds with studio-quality output.</p>
                  </div>
                </div>

                <Link to="/studio">
                  <Button variant="studio" size="lg" className="w-full mt-4">
                    <Split className="w-5 h-5" />
                    Try Split Voice Now
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Everything You Need for <span className="text-primary">Voice Creation</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional tools, simple interface, stunning results.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: Mic,
                title: "8 Premium Voices",
                description: "Choose from natural-sounding male and female voices with unique personalities.",
                color: "primary"
              },
              {
                icon: Split,
                title: "Split Voice Mode",
                description: "Create dialogues with multiple speakers using simple [MALE] and [FEMALE] tags.",
                color: "accent"
              },
              {
                icon: Users,
                title: "Multi-Speaker",
                description: "Configure custom speakers with names and voices for complex productions.",
                color: "primary"
              },
              {
                icon: Sparkles,
                title: "Expressive Actions",
                description: "Add emotions with [pause], [giggles], [sigh] and other action tags.",
                color: "accent"
              },
              {
                icon: Zap,
                title: "Instant Generation",
                description: "Get your voiceover in seconds with auto-play preview.",
                color: "primary"
              },
              {
                icon: Volume2,
                title: "High Quality Audio",
                description: "Download studio-quality MP3 files ready for any production.",
                color: "accent"
              }
            ].map((feature, i) => (
              <Card key={i} className="p-6 bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-all hover:shadow-xl hover:-translate-y-1 group">
                <div className={`w-12 h-12 bg-${feature.color}/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 text-${feature.color} icon-3d`} />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold">
              Ready to <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Create?</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Start generating professional voiceovers in seconds. No signup required.
            </p>
            <Link to="/studio">
              <Button variant="studio" size="lg" className="text-lg px-12 py-7 shadow-2xl hover:scale-105 transition-transform">
                <Mic className="w-6 h-6" />
                Launch Voice Studio
                <ArrowRight className="w-6 h-6" />
              </Button>
            </Link>
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-4">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Free to use
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                No signup
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                10,000 characters
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={sommyartLogo} alt="Sommyart Labs" className="w-8 h-8 rounded-lg" />
              <span className="text-sm text-muted-foreground">
                © 2024 Sommyart Labs. AI Voice Generation.
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Powered by ElevenLabs Multilingual V2
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
