import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CheckoutModal from "./CheckoutModal";

vi.mock("./MapPicker", () => ({
  default: ({
    onChange,
  }: {
    onChange: (coords: { lat: number; lng: number }) => void;
  }) => (
    <button type="button" onClick={() => onChange({ lat: 42.8746, lng: 74.5698 })}>
      pick-on-map
    </button>
  ),
}));

describe("CheckoutModal", () => {
  it("shows warning when coordinates are invalid", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <CheckoutModal open total={100} onClose={() => undefined} onSubmit={onSubmit} />
    );

    const lat = container.querySelectorAll(".coords-row input")[0] as HTMLInputElement;
    const lng = container.querySelectorAll(".coords-row input")[1] as HTMLInputElement;
    fireEvent.change(lat, { target: { value: "999" } });
    fireEvent.change(lng, { target: { value: "74.5698" } });

    expect(screen.getByText("Широта должна быть от -90 до 90")).toBeInTheDocument();
    expect(screen.getByText("Координаты не будут добавлены")).toBeInTheDocument();
  });

  it("submits explicit delivery coordinates when coordinates are valid", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<CheckoutModal open total={100} onClose={() => undefined} onSubmit={onSubmit} />);

    const lat = container.querySelectorAll(".coords-row input")[0] as HTMLInputElement;
    const lng = container.querySelectorAll(".coords-row input")[1] as HTMLInputElement;
    fireEvent.change(lat, { target: { value: "42.8746" } });
    fireEvent.change(lng, { target: { value: "74.5698" } });
    fireEvent.click(screen.getByRole("button", { name: "Создать заказ" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          comment: "",
          delivery_lat: 42.8746,
          delivery_lng: 74.5698,
        })
      );
    });
  });
});
