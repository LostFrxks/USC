const rawApiBase = process.env.EXPO_PUBLIC_API_BASE?.trim();

if (!rawApiBase) {
  throw new Error("EXPO_PUBLIC_API_BASE is required for frontend_mobile.");
}

export const API_BASE = rawApiBase.replace(/\/+$/, "");
export const MAP_DEFAULT_LAT = Number(process.env.EXPO_PUBLIC_MAP_DEFAULT_LAT ?? 42.8746);
export const MAP_DEFAULT_LNG = Number(process.env.EXPO_PUBLIC_MAP_DEFAULT_LNG ?? 74.5698);
export const MAP_DEFAULT_ZOOM = Number(process.env.EXPO_PUBLIC_MAP_DEFAULT_ZOOM ?? 12);
