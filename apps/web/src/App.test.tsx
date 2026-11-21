import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the catalogue shell", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /product catalogue/i }),
    ).toBeInTheDocument();
  });
});
