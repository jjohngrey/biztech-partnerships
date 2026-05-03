const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
  <rect width="180" height="180" rx="38" fill="#111113"/>
  <path d="M51 55h78v18H51zM51 81h56v18H51zM51 107h78v18H51z" fill="#d4d4d8"/>
</svg>`;

export function GET() {
  return new Response(iconSvg, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/svg+xml",
    },
  });
}
