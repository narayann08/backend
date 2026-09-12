import MockCard from '../components/MockCard';

/*
 * The hero's central visual: the aerial solar-field footage, framed as an
 * instrument panel rather than a background layer. `bleed` on MockCard drops
 * its padding so the video runs edge-to-edge under the label bar.
 */
export default function HeroVideoCard({ className = '' }) {
  return (
    <MockCard
      className={className}
      bleed
      label="Bhadla Solar Park · Block IV"
      caption="Live"
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/marketing/hero-video.jpg"
        src="/marketing/hero-video.mp4"
        className="block aspect-video w-full object-cover"
      />
    </MockCard>
  );
}
