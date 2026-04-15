import { describe, expect, it } from "vitest";
import {
  appendGeoTag,
  formatGeoTag,
  isValidLatLng,
  parseGeoTag,
  stripGeoTag,
  validateLatLngInputs,
} from "./geo";

describe("geo utils", () => {
  it("validates latitude and longitude ranges", () => {
    expect(isValidLatLng({ lat: 42.8746, lng: 74.5698 })).toBe(true);
    expect(isValidLatLng({ lat: -90, lng: 180 })).toBe(true);
    expect(isValidLatLng({ lat: 90.0001, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 0, lng: -180.0001 })).toBe(false);
    expect(isValidLatLng(null)).toBe(false);
  });

  it("formats geo tag with 6 decimals", () => {
    expect(formatGeoTag({ lat: 42.8746123, lng: 74.5698123 })).toBe("[geo:42.874612,74.569812]");
  });

  it("appends geo tag and removes previous tags", () => {
    const withGeo = appendGeoTag("Позвоните за 10 минут", { lat: 42.8746, lng: 74.5698 });
    expect(withGeo).toBe("Позвоните за 10 минут\n[geo:42.874600,74.569800]");

    const replaced = appendGeoTag("Тест [geo:1,2] comment", { lat: 10, lng: 20 });
    expect(replaced).toBe("Тест comment\n[geo:10.000000,20.000000]");

    const withoutGeo = appendGeoTag("Только комментарий", { lat: 200, lng: 20 });
    expect(withoutGeo).toBe("Только комментарий");
  });

  it("parses geo tags from comments", () => {
    expect(parseGeoTag("test [geo:42.874600,74.569800]")).toEqual({ lat: 42.8746, lng: 74.5698 });
    expect(parseGeoTag("test [ geo : 42.874600 , 74.569800 ]")).toEqual({ lat: 42.8746, lng: 74.5698 });
    expect(parseGeoTag("test [geo:120,10]")).toBeNull();
    expect(parseGeoTag("test")).toBeNull();
  });

  it("strips geo tag from display text", () => {
    expect(stripGeoTag("Позвоните\n[geo:42.874600,74.569800]")).toBe("Позвоните");
    expect(stripGeoTag("[geo:42.874600,74.569800]")).toBe("");
  });

  it("returns explicit input validation states", () => {
    expect(validateLatLngInputs("", "").kind).toBe("empty");
    expect(validateLatLngInputs("x", "74").kind).toBe("invalid_number");
    expect(validateLatLngInputs("91", "74").kind).toBe("out_of_range");
    expect(validateLatLngInputs("42.8746", "74.5698")).toEqual({
      kind: "valid",
      coords: { lat: 42.8746, lng: 74.5698 },
      message: null,
    });
  });
});
