const preloadedImages = new Set<string>();

export function preloadImages(urls: Array<string | null | undefined>) {
  if (typeof window === "undefined") return;

  urls.forEach((url) => {
    if (!url || preloadedImages.has(url)) return;
    preloadedImages.add(url);

    const img = new Image();
    img.decoding = "async";
    img.src = url;
  });
}
