import { PageTransition } from "@/components/motion/PageTransition";
import { HeroSection } from "@/components/sections/hero/HeroSection";
import PhilosophySection from "@/components/sections/philosophy";
import ProgramsSection from "@/components/sections/programs/ProgramsSection";
import MenuSection from "@/components/sections/menu/MenuSection";
import GallerySection from "@/components/sections/gallery/GallerySection";
import TestimonialsSection from "@/components/sections/testimonials/TestimonialsSection";
import TeachersSection from "@/components/sections/teachers/TeachersSection";

/**
 * Home route (04 §1, 05 §5.7, §5.8).
 *
 * `PageTransition` → `<main id="main" data-snap-root>` → the home sections, in
 * scroll order. Three things about that shape are decisions rather than
 * arrangement:
 *
 * - **`PageTransition` is here, not in the layout.** A layout persists across a
 *   navigation, so its subtree neither enters nor exits and the subpage slide
 *   would never fire. Two sibling pages each wrapping themselves is what gives
 *   React an exit on one side and an enter on the other (05 `D-05.10`).
 * - **`<main>` is the page's, not the layout's.** The home page is the only one
 *   that scroll-snaps, so it is the only one that may carry `data-snap-root`;
 *   `app/[locale]/layout.tsx` renders no landmark of its own for exactly that
 *   reason (04 §1). The skip link targets `#main` here.
 * - **The child of `PageTransition` is a single element.** React snapshots what
 *   it finds, and a fragment of siblings gives the browser several boxes to
 *   name.
 *
 * The remaining seven sections of 04 §1 land in Phase 5 and slot in below the
 * hero in `SECTION_IDS` order; nothing else in this file changes when they do.
 */
export default function HomePage() {
  return (
    <PageTransition>
      <main id="main" data-snap-root="">
        <HeroSection />
        <PhilosophySection />
        <ProgramsSection />
        <MenuSection />
        <GallerySection />
        <TestimonialsSection />
        <TeachersSection />
      </main>
    </PageTransition>
  );
}
