import { describe, it, expect } from "vitest";

const REQUIRED_FIELDS = ["firstName", "lastName", "email", "summary"];

function getCompletion(profile) {
  const filled = REQUIRED_FIELDS.filter((f) => profile[f].trim() !== "").length;
  return Math.round((filled / REQUIRED_FIELDS.length) * 100);
}

describe("Profile Completion Indicator", () => {
  it("returns 0% when all fields are empty", () => {
    const profile = { firstName: "", lastName: "", email: "", summary: "" };
    expect(getCompletion(profile)).toBe(0);
  });

  it("returns 100% when all required fields are filled", () => {
    const profile = { firstName: "Jane", lastName: "Doe", email: "jane@example.com", summary: "Developer" };
    expect(getCompletion(profile)).toBe(100);
  });

  it("returns 75% when 3 of 4 required fields are filled", () => {
    const profile = { firstName: "Jane", lastName: "Doe", email: "jane@example.com", summary: "" };
    expect(getCompletion(profile)).toBe(75);
  });

  it("does not count phone as a required field", () => {
    const profile = { firstName: "Jane", lastName: "Doe", email: "jane@example.com", summary: "Dev", phone: "" };
    expect(getCompletion(profile)).toBe(100);
  });
});
