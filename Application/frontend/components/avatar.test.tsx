import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Avatar } from "@/components/avatar";

afterEach(cleanup);

describe("Avatar", () => {
  it("renders an img when a url is given", () => {
    render(<Avatar url="/images/x.png" name="John Doe" />);
    const img = screen.getByRole("img", { name: /john doe/i });
    expect(img).toBeInTheDocument();
  });

  it("renders an icon fallback when url is null", () => {
    render(<Avatar url={null} name="John Doe" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("avatar-fallback")).toBeInTheDocument();
  });
});