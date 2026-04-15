import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CartScreen from "./CartScreen";

const mockCreateOrder = vi.fn();

vi.mock("../api/orders", () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}));

vi.mock("../ui/MapPicker", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: { lat: number; lng: number } | null;
    onChange: (coords: { lat: number; lng: number }) => void;
  }) => (
    <div data-testid="map-picker">
      <button type="button" onClick={() => onChange({ lat: 42.8746, lng: 74.5698 })}>
        pick-on-map
      </button>
      <span>{value ? `${value.lat},${value.lng}` : "none"}</span>
    </div>
  ),
}));

describe("CartScreen map checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateOrder.mockResolvedValue({ id: 1, status: "created" });
  });

  const baseProps = {
    active: true,
    items: [
      {
        product: {
          id: "1",
          name: "Beef Premium",
          seller: "NorthPeak Foods",
          price: 100,
          rating: "4.9",
          reviews: 10,
          image: "/media/meat.png",
          category: "meat" as const,
          supplier_company_id: 200,
        },
        qty: 2,
      },
    ],
    total: 200,
    onInc: vi.fn(),
    onDec: vi.fn(),
    onRemove: vi.fn(),
    onClear: vi.fn(),
    cartCount: 2,
    onBurger: vi.fn(),
    onCheckoutSuccess: vi.fn(),
    buyerCompanyId: 100,
    onNotify: vi.fn(),
  };

  it("renders map picker when checkout is opened", async () => {
    render(<CartScreen {...baseProps} />);
    fireEvent.click(screen.getByTestId("cart-open-checkout"));
    expect(await screen.findByTestId("map-picker")).toBeInTheDocument();
  });

  it("shows warning for invalid coordinate input", async () => {
    const { container } = render(<CartScreen {...baseProps} />);
    fireEvent.click(screen.getByTestId("cart-open-checkout"));
    await screen.findByTestId("map-picker");

    const lat = container.querySelectorAll(".coords-row input")[0] as HTMLInputElement;
    const lng = container.querySelectorAll(".coords-row input")[1] as HTMLInputElement;
    fireEvent.change(lat, { target: { value: "abc" } });
    fireEvent.change(lng, { target: { value: "74.5698" } });

    expect(screen.getByText("Введите числовые координаты")).toBeInTheDocument();
    expect(screen.getByText("Координаты не будут добавлены")).toBeInTheDocument();
  });

  it("sends explicit delivery coordinates when creating order", async () => {
    render(<CartScreen {...baseProps} />);
    fireEvent.click(screen.getByTestId("cart-open-checkout"));

    fireEvent.click(await screen.findByRole("button", { name: "pick-on-map" }));
    fireEvent.click(screen.getByTestId("cart-create-order"));

    await waitFor(() => {
      expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        comment: "",
        delivery_lat: 42.8746,
        delivery_lng: 74.5698,
      })
    );
  });
});
