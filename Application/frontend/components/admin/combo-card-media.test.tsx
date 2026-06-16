import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComboCardMedia } from "./combo-card-media";

describe("ComboCardMedia", () => {
  it("renders the image when a url is provided", () => {
    const { container } = render(<ComboCardMedia url="/images/combo.jpg" label="Lunch Duo" />);
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("falls back to the branded placeholder when the image fails to load", () => {
    const { container } = render(<ComboCardMedia url="/images/missing.jpg" label="Family Feast" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".cover-stripe")).not.toBeNull();
  });

  it("renders the placeholder immediately when url is null", () => {
    const { container } = render(<ComboCardMedia url={null} label="Pick-Any Feast" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".cover-stripe")).not.toBeNull();
  });
});
