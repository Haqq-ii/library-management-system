import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth guard
vi.mock("@/lib/require-role", () => ({
  requireRole: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { fetchBookByISBN } from "@/features/catalog/actions";
import { requireRole } from "@/lib/require-role";

describe("fetchBookByISBN", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({ user: { role: "LIBRARIAN" } } as any);
  });

  it("returns title and author for a known ISBN", async () => {
    const mockResponse = {
      "ISBN:9780140449136": {
        title: "The Divine Comedy",
        authors: [{ name: "Dante Alighieri" }],
        publishers: [{ name: "Penguin Classics" }],
        publish_date: "1995",
      },
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as any);

    const result = await fetchBookByISBN("9780140449136");
    expect(result).toEqual({
      success: true,
      data: {
        title: "The Divine Comedy",
        author: "Dante Alighieri",
        publisher: "Penguin Classics",
        publishedYear: 1995,
      },
    });
  });

  it("returns ISBN_NOT_FOUND error for an unknown ISBN", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as any);

    const result = await fetchBookByISBN("0000000000000");
    expect(result).toEqual({ success: false, error: "ISBN_NOT_FOUND" });
  });

  it("returns API_UNREACHABLE when fetch fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
    } as any);

    const result = await fetchBookByISBN("9780140449136");
    expect(result).toEqual({ success: false, error: "API_UNREACHABLE" });
  });

  it("uses server-side fetch with User-Agent header (avoids CORS)", async () => {
    const mockResponse = {
      "ISBN:9780140449136": {
        title: "The Divine Comedy",
        authors: [{ name: "Dante Alighieri" }],
        publishers: [],
        publish_date: null,
      },
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as any);

    await fetchBookByISBN("9780140449136");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("openlibrary.org"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("LibraryManagementSystem"),
        }),
      })
    );
  });
});
