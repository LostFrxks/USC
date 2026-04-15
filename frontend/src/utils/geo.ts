export type LatLng = {
  lat: number;
  lng: number;
};

const GEO_TAG_REGEX = /\[geo:[^\]]*]/gi;
const GEO_TAG_CAPTURE_REGEX = /\[\s*geo\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*]/i;

export type LatLngInputState =
  | { kind: "empty"; coords: null; message: null }
  | { kind: "invalid_number"; coords: null; message: string }
  | { kind: "out_of_range"; coords: null; message: string }
  | { kind: "valid"; coords: LatLng; message: null };

export function isValidLatLng(coords: LatLng | null | undefined): coords is LatLng {
  if (!coords) return false;
  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return false;
  return coords.lat >= -90 && coords.lat <= 90 && coords.lng >= -180 && coords.lng <= 180;
}

export function formatGeoTag(coords: LatLng): string {
  return `[geo:${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}]`;
}

export function appendGeoTag(comment: string, coords: LatLng | null | undefined): string {
  const base = String(comment || "")
    .replace(GEO_TAG_REGEX, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!isValidLatLng(coords)) return base;

  const tag = formatGeoTag(coords);
  return base ? `${base}\n${tag}` : tag;
}

export function stripGeoTag(comment: string | null | undefined): string {
  return String(comment || "")
    .replace(GEO_TAG_REGEX, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseGeoTag(comment: string | null | undefined): LatLng | null {
  if (!comment) return null;
  const match = comment.match(GEO_TAG_CAPTURE_REGEX);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  const coords = { lat, lng };
  return isValidLatLng(coords) ? coords : null;
}

export function toOsmLink(coords: LatLng, zoom = 16): string {
  return `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=${zoom}/${coords.lat}/${coords.lng}`;
}

export function validateLatLngInputs(latRaw: string, lngRaw: string): LatLngInputState {
  const latText = latRaw.trim();
  const lngText = lngRaw.trim();
  if (!latText && !lngText) return { kind: "empty", coords: null, message: null };

  const lat = Number(latText.replace(",", "."));
  const lng = Number(lngText.replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      kind: "invalid_number",
      coords: null,
      message: "Введите числовые координаты",
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      kind: "out_of_range",
      coords: null,
      message: "Широта должна быть от -90 до 90",
    };
  }
  if (lng < -180 || lng > 180) {
    return {
      kind: "out_of_range",
      coords: null,
      message: "Долгота должна быть от -180 до 180",
    };
  }

  return {
    kind: "valid",
    coords: { lat, lng },
    message: null,
  };
}
