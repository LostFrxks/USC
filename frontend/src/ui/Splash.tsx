export function Splash({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div id="splash" className="splash">
      <div className="splash-logo-row">
        <img src="media/u.svg" className="splash-letter splash-u" alt="U" />
        <img src="media/s.svg" className="splash-letter splash-s" alt="S" />
        <img src="media/c.svg" className="splash-letter splash-c" alt="C" />
        <img src="media/chain.svg" className="splash-letter splash-chain" alt="Chain" />
      </div>
      <div className="splash-tagline">
        <img src="media/desc.svg" className="splash-desc" alt="Unity supply chain" />
      </div>
    </div>
  );
}
