import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import ProfileEditScreen from "./ProfileEditScreen";

const mockUpdateMe = vi.fn();

vi.mock("../api/profile", () => ({
  updateMe: (...args: unknown[]) => mockUpdateMe(...args),
}));

describe("ProfileEditScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefills fields from profile and submits update payload", async () => {
    const profile = {
      id: 1,
      email: "john@test.local",
      first_name: "John",
      last_name: "Smith",
      phone: "+996700111111",
      role: "buyer",
      companies: [
        {
          company_id: 10,
          name: "Old Company",
          company_type: "BUYER",
          phone: "+996700000000",
          address: "Old Address",
        },
      ],
    };

    mockUpdateMe.mockResolvedValueOnce({
      ...profile,
      first_name: "Jane",
      last_name: "Doe",
    });

    const onSaved = vi.fn();

    const { container } = render(
      <ProfileEditScreen
        active
        onBurger={() => undefined}
        profile={profile}
        activeCompanyId={10}
        onNotify={() => undefined}
        onSaved={onSaved}
      />
    );

    const allInputs = Array.from(container.querySelectorAll("input"));
    const fullNameInput = allInputs[0] as HTMLInputElement;
    const emailInput = allInputs[1] as HTMLInputElement;
    const companyInput = allInputs[3] as HTMLInputElement;

    expect(fullNameInput.value).toBe("John Smith");
    expect(emailInput.value).toBe("john@test.local");
    expect(companyInput.value).toBe("Old Company");

    fireEvent.change(fullNameInput, { target: { value: "Jane Doe" } });
    fireEvent.change(companyInput, { target: { value: "New Company" } });

    const submit = container.querySelector("button.profile-edit-submit") as HTMLButtonElement;
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mockUpdateMe).toHaveBeenCalledTimes(1);
    });

    expect(mockUpdateMe).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Jane",
        last_name: "Doe",
        email: "john@test.local",
        active_company_id: 10,
        company_name: "New Company",
      })
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
