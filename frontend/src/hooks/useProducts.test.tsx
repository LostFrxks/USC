import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProducts } from "./useProducts";

const mockFetchProducts = vi.fn();

vi.mock("../api/products", () => ({
  fetchProducts: (...args: unknown[]) => mockFetchProducts(...args),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useProducts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchProducts.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps previous products during refresh instead of dropping into skeleton state", async () => {
    const first = deferred<any[]>();
    const second = deferred<any[]>();
    mockFetchProducts.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(
      ({ categoryId, query }) => useProducts(categoryId, query),
      { initialProps: { categoryId: 1, query: "" } }
    );

    await act(async () => {
      vi.advanceTimersByTime(140);
      await flushMicrotasks();
    });
    expect(mockFetchProducts).toHaveBeenCalledTimes(1);
    first.resolve([{ id: "1", name: "Milk", seller: "A", price: 10, image: "/a.jpg", category: "milk" }]);
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.products).toHaveLength(1);

    rerender({ categoryId: 2, query: "" });
    await act(async () => {
      vi.advanceTimersByTime(140);
      await flushMicrotasks();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    expect(result.current.products[0]?.id).toBe("1");

    second.resolve([{ id: "2", name: "Fish", seller: "B", price: 20, image: "/b.jpg", category: "fish" }]);
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.refreshing).toBe(false);
    expect(result.current.products[0]?.id).toBe("2");
  });

  it("preserves previous products when a refresh request fails", async () => {
    const first = deferred<any[]>();
    const second = deferred<any[]>();
    mockFetchProducts.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(
      ({ categoryId, query }) => useProducts(categoryId, query),
      { initialProps: { categoryId: 1, query: "" } }
    );

    await act(async () => {
      vi.advanceTimersByTime(140);
      await flushMicrotasks();
    });
    first.resolve([{ id: "1", name: "Bread", seller: "A", price: 12, image: "/a.jpg", category: "bread" }]);
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.products[0]?.id).toBe("1");

    rerender({ categoryId: 1, query: "bread" });
    await act(async () => {
      vi.advanceTimersByTime(140);
      await flushMicrotasks();
    });
    second.reject(new Error("network"));

    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.refreshing).toBe(false);
    expect(result.current.apiOk).toBe(false);
    expect(result.current.products[0]?.id).toBe("1");
  });
});
