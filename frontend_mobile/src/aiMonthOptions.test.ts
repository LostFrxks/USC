import { buildAiMonthOptions } from "@/screens/aiMonthOptions";

describe("ai month options", () => {
  it("builds unique compact month options from analytics trends", () => {
    const result = buildAiMonthOptions([
      { month: "2026-01", revenue: 100 },
      { month: "2026-02", revenue: 120 },
      { month: "2026-02", revenue: 130 },
      { month: "2026-03", revenue: 160 },
    ]);

    expect(result).toEqual([
      { value: "2026-01", label: "Jan" },
      { value: "2026-02", label: "Feb" },
      { value: "2026-03", label: "Mar" },
    ]);
  });
});
