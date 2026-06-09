import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BookStatusBadge } from "@/components/catalog/BookStatusBadge";

describe("BookStatusBadge", () => {
  it("renders AVAILABLE status with green color class", () => {
    const { container } = render(<BookStatusBadge status="AVAILABLE" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.className).toContain("green");
    expect(badge.textContent).toContain("AVAILABLE");
  });

  it("renders CHECKED_OUT status with yellow color class", () => {
    const { container } = render(<BookStatusBadge status="CHECKED_OUT" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("yellow");
    expect(badge.textContent).toMatch(/checked.out/i);
  });

  it("renders RESERVED status with blue color class", () => {
    const { container } = render(<BookStatusBadge status="RESERVED" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("blue");
  });

  it("renders LOST status with red color class", () => {
    const { container } = render(<BookStatusBadge status="LOST" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("red");
  });

  it("renders WITHDRAWN status with red color class", () => {
    const { container } = render(<BookStatusBadge status="WITHDRAWN" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("red");
  });

  it("renders all 5 CopyStatus values without throwing", () => {
    const statuses = ["AVAILABLE", "CHECKED_OUT", "RESERVED", "LOST", "WITHDRAWN"] as const;
    statuses.forEach((status) => {
      expect(() => render(<BookStatusBadge status={status} />)).not.toThrow();
    });
  });
});
