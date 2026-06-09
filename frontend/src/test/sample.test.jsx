import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

function Greeting({ name }) {
  return <h1>Hello, {name}</h1>;
}

describe("Greeting", () => {
  it("renders the name", () => {
    render(<Greeting name="ATS Rocket" />);
    expect(screen.getByText("Hello, ATS Rocket")).toBeInTheDocument();
  });
});
