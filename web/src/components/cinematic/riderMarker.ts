const FALLBACK_BIKE_SVG = `
  <svg class="rider__bike" viewBox="0 0 48 72" aria-hidden="true">
    <!-- wheels -->
    <rect x="20" y="9"  width="8" height="16" rx="4" fill="#14110f"/>
    <rect x="20" y="47" width="8" height="18" rx="4" fill="#14110f"/>
    <!-- frame -->
    <rect x="18.5" y="22" width="11" height="30" rx="5.5" fill="#26211d"/>
    <!-- handlebars -->
    <rect x="9" y="24.5" width="30" height="4.5" rx="2.25" fill="#1b1714"/>
    <!-- headlight -->
    <rect x="20.5" y="16" width="7" height="5" rx="2.5" fill="#fff3d6"/>
    <!-- rider body -->
    <rect x="13.5" y="30" width="21" height="19" rx="8" fill="#ff6b00"/>
    <rect x="13.5" y="30" width="21" height="8"  rx="4" fill="#ff8534"/>
    <!-- arms reaching the bars -->
    <rect x="10.5" y="26" width="5.5" height="10" rx="2.75" fill="#ff8534" transform="rotate(-14 13 31)"/>
    <rect x="32"   y="26" width="5.5" height="10" rx="2.75" fill="#ff8534" transform="rotate(14 35 31)"/>
    <!-- helmet -->
    <circle cx="24" cy="33.5" r="8.5" fill="#141414"/>
    <circle cx="24" cy="33.5" r="8.5" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.2"/>
    <path d="M17.5 31.5a8.5 8.5 0 0 1 13 0z" fill="#4cc2ff" opacity="0.9"/>
  </svg>
`;

/** Path a real top-down render should be saved to — see web/README.md. */
export const RIDER_TOP_IMAGE_SRC = "/assets/boda-top-premium.png";
/** Path a real side-profile render should be saved to — see web/README.md. */
export const RIDER_SIDE_IMAGE_SRC = "/assets/boda-side-premium.png";

/**
 * Builds the boda rider element used as a MapLibre marker. Plain DOM rather
 * than a React component because the animation loop mutates it every frame —
 * re-rendering React 60 times a second for a transform would be wasteful.
 *
 * Tries the real photoreal top-down render first; if that file doesn't
 * exist yet (a 404 in dev, or before it's been added to the project) it
 * falls back to the drawn SVG bike instead of showing a broken image.
 *
 * Drawn/photographed top-down with the bike nosing "up" (bearing 0 =
 * north), so the marker's rotation can be set directly from the path
 * bearing.
 */
export function createRiderElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "rider";
  el.innerHTML = `
    <div class="rider__beam"></div>
    <div class="rider__shadow"></div>
    <img class="rider__bike rider__bike--photo" src="${RIDER_TOP_IMAGE_SRC}" alt="" />
  `;

  const img = el.querySelector<HTMLImageElement>(".rider__bike--photo");
  img?.addEventListener(
    "error",
    () => {
      img.outerHTML = FALLBACK_BIKE_SVG;
    },
    { once: true }
  );

  return el;
}

/**
 * Top-down tree canopy sprite, scattered across real park/grass/wood
 * polygons sampled from the map's own vector data (see lib/vegetation.ts).
 * Two offset blobs read as canopy-with-depth from the ride's steep pitch
 * without needing an actual 3D model.
 */
export function createTreeElement(scale = 1): HTMLElement {
  const el = document.createElement("div");
  el.className = "veg-tree";
  const hue = Math.round((Math.random() - 0.5) * 30);
  el.style.transform = `scale(${scale.toFixed(2)})`;
  el.style.filter = `hue-rotate(${hue}deg)`;
  el.innerHTML = `
    <div class="veg-tree__shadow"></div>
    <div class="veg-tree__canopy-back"></div>
    <div class="veg-tree__canopy-front"></div>
    <div class="veg-tree__trunk"></div>
  `;
  return el;
}

/** Directional puck for live navigation — this is "you", not a cinematic actor. */
export function createUserPuckElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "puck";
  el.innerHTML = `
    <div class="puck__cone"></div>
    <div class="puck__pulse"></div>
    <div class="puck__core"></div>
  `;
  return el;
}
