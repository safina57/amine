import { useEffect, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { SiGithub, SiX } from "@icons-pack/react-simple-icons";
import { FileText } from "lucide-react";

import { Ambience } from "@/components/ambience";
import { LinkedInIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { createScene } from "@/scene/Scene";

const ME = {
  name: "Amine",
  line: "Software engineer.",
  // Descriptive filename on purpose: it is what a recruiter ends up with
  // on disk after saving. Opens in a tab rather than force-downloading.
  resume: "/Mohamed_Amine_Haouas_Resume.pdf",
  links: [
    { label: "GitHub", href: "https://github.com/safina57", icon: SiGithub },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/mohamed-amin-haouas/",
      icon: LinkedInIcon,
    },
    { label: "X", href: "https://x.com/med_haouas", icon: SiX },
  ],
};

function Scene() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const handle = createScene(ref.current);
    return () => handle.destroy();
  }, []);

  return (
    <div
      ref={ref}
      className="absolute inset-0"
      role="img"
      aria-label="A painted clifftop view over a green river valley toward a distant city, with a wooden desk and laptop under an overhanging oak canopy, and a cat asleep on the desk."
    />
  );
}

export function App() {
  return (
    <main className="relative h-svh overflow-hidden">
      <Scene />

      <Ambience />

      {/* Cookieless, so no consent banner: aggregate traffic only, never
          identities. SpeedInsights reports Core Web Vitals from real visitors,
          which is the number that matters for a page shipping this much art. */}
      <Analytics />
      <SpeedInsights />

      {/* A scrim, not a panel: the copy sits over sunlit grass and water, and
          needs footing without a card boxing it off from the painting. */}
      <div
        aria-hidden
        className="scrim pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
      />

      {/* Anchored to the bottom-left so the type sits on the scene's ground
          plane rather than floating in the middle of the sky. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-5 p-8 sm:p-12 lg:p-16">
        <div className="flex flex-col gap-3">
          <h1 className="display on-scene text-6xl sm:text-7xl lg:text-8xl">
            {ME.name}
          </h1>
          <p className="sill on-scene max-w-[42ch] text-base sm:text-lg">
            {ME.line}
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* Base UI composes via `render`, not Radix's `asChild`. */}
          <Button
            size="lg"
            className="h-11 px-5"
            render={<a href={ME.resume} target="_blank" rel="noopener noreferrer" />}
          >
            <FileText data-icon="inline-start" />
            Resume
          </Button>

          {ME.links.map(({ label, href, icon: Icon }) => (
            <Button
              key={label}
              variant="link"
              className="on-scene px-0"
              render={<a href={href} target="_blank" rel="noopener noreferrer" />}
            >
              <Icon data-icon="inline-start" />
              {label}
            </Button>
          ))}
        </nav>
      </div>
    </main>
  );
}

export default App;
