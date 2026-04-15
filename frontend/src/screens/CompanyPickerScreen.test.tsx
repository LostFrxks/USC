import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CompanyPickerScreen from "./CompanyPickerScreen";

const profile = {
  id: 1,
  email: "owner@test.local",
  first_name: "Owner",
  last_name: "User",
  companies: [
    { company_id: 10, name: "Buyer Co", company_type: "BUYER" },
    { company_id: 20, name: "Supplier Co", company_type: "SUPPLIER" },
  ],
};

describe("CompanyPickerScreen", () => {
  it("filters companies by requested role when opened from role switch", () => {
    render(
      <CompanyPickerScreen
        profile={profile}
        selectedId={20}
        roleFilter="supplier"
        onSelect={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText("Supplier Co")).toBeInTheDocument();
    expect(screen.queryByText("Buyer Co")).not.toBeInTheDocument();
  });

  it("shows the full company list during regular company switching", () => {
    render(
      <CompanyPickerScreen
        profile={profile}
        selectedId={10}
        roleFilter={null}
        onSelect={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText("Buyer Co")).toBeInTheDocument();
    expect(screen.getByText("Supplier Co")).toBeInTheDocument();
  });
});
