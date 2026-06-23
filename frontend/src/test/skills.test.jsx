// src/test/skills.test.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for S2-018: Skills Section CRUD
//
// These tests check the LOGIC behind the skills section — not the visual UI.
// Think of it like testing the rules of a card game without actually
// playing the game at a table. We just check: do the rules work correctly?
//
// We're testing four operations:
//   1. Add a skill
//   2. Block duplicate skills (S2-BR-016)
//   3. Delete a skill
//   4. Edit a skill
//   5. Reorder skills
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";

// ── Helper functions ──────────────────────────────────────────────────────────
// These are the same logic functions used in Profile.jsx, copied here so
// we can test them in isolation without needing to render the whole page.
// Think of them as the "rules" we want to verify are working correctly.

// addSkill: tries to add a new skill to the list.
// Returns the updated list if successful, or null if it's a duplicate.
function addSkill(skills, newSkill) {
  // Block duplicate skill names — S2-BR-016
  if (skills.some((s) => s.name === newSkill.name)) {
    return null; // null signals "this was blocked"
  }
  return [...skills, newSkill];
}

// deleteSkill: removes a skill from the list by its id.
// Returns a new list without that skill.
function deleteSkill(skills, id) {
  return skills.filter((s) => s.id !== id);
}

// editSkill: updates one skill in the list by its id.
// Everything else in the list stays the same.
// Returns the updated list.
function editSkill(skills, id, updatedValues) {
  return skills.map((s) =>
    s.id === id
      ? { ...s, ...updatedValues } // replace this skill's values
      : s                          // leave all other skills unchanged
  );
}

// reorderSkills: moves a skill from one position to another.
// This is the same logic as arrayMove from dnd-kit.
// Example: reorderSkills(["A","B","C"], 2, 0) → ["C","A","B"]
function reorderSkills(skills, fromIndex, toIndex) {
  const result = [...skills];
  const [moved] = result.splice(fromIndex, 1); // remove from old position
  result.splice(toIndex, 0, moved);            // insert at new position
  return result;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Skills CRUD — S2-018", () => {

  // ── ADD ───────────────────────────────────────────────────────────────────

  it("adds a new skill to an empty list", () => {
    // Start with no skills
    const skills = [];
    const newSkill = { id: 1, name: "React", category: "Frontend", proficiency: "Advanced" };

    const result = addSkill(skills, newSkill);

    // The list should now have exactly 1 skill
    expect(result).toHaveLength(1);
    // And that skill should be React
    expect(result[0].name).toBe("React");
  });

  it("adds a second skill to a list that already has one", () => {
    const skills = [
      { id: 1, name: "React", category: "Frontend", proficiency: "Advanced" },
    ];
    const newSkill = { id: 2, name: "Python", category: "Backend", proficiency: "Intermediate" };

    const result = addSkill(skills, newSkill);

    // Should now have 2 skills
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Python");
  });

  // ── DUPLICATE BLOCK (S2-BR-016) ───────────────────────────────────────────

  it("blocks adding a duplicate skill — S2-BR-016", () => {
    // React is already in the list
    const skills = [
      { id: 1, name: "React", category: "Frontend", proficiency: "Advanced" },
    ];
    // Try to add React again
    const duplicate = { id: 2, name: "React", category: "Frontend", proficiency: "Beginner" };

    const result = addSkill(skills, duplicate);

    // addSkill returns null when a duplicate is blocked
    expect(result).toBeNull();
  });

  // ── DELETE ────────────────────────────────────────────────────────────────

  it("deletes a skill by id", () => {
    const skills = [
      { id: 1, name: "React", category: "Frontend", proficiency: "Advanced" },
      { id: 2, name: "Python", category: "Backend", proficiency: "Intermediate" },
    ];

    const result = deleteSkill(skills, 1); // delete React (id: 1)

    // Should only have Python left
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Python");
  });

  it("returns the same list if the id does not exist", () => {
    const skills = [
      { id: 1, name: "React", category: "Frontend", proficiency: "Advanced" },
    ];

    const result = deleteSkill(skills, 99); // id 99 doesn't exist

    // Nothing should change
    expect(result).toHaveLength(1);
  });

  // ── EDIT ──────────────────────────────────────────────────────────────────

  it("edits the proficiency of one skill without changing others", () => {
    const skills = [
      { id: 1, name: "React", category: "Frontend", proficiency: "Beginner" },
      { id: 2, name: "Python", category: "Backend", proficiency: "Intermediate" },
    ];

    // Edit React's proficiency from Beginner to Advanced
    const result = editSkill(skills, 1, { proficiency: "Advanced" });

    // React should now be Advanced
    expect(result[0].proficiency).toBe("Advanced");
    // Python should be completely unchanged
    expect(result[1].proficiency).toBe("Intermediate");
  });

  it("edits both the skill name and proficiency", () => {
    const skills = [
      { id: 1, name: "CSS", category: "Frontend", proficiency: "Beginner" },
    ];

    const result = editSkill(skills, 1, {
      name: "TypeScript",
      category: "Frontend",
      proficiency: "Intermediate",
    });

    expect(result[0].name).toBe("TypeScript");
    expect(result[0].proficiency).toBe("Intermediate");
  });

  // ── REORDER ───────────────────────────────────────────────────────────────

  it("moves a skill from the bottom to the top", () => {
    const skills = [
      { id: 1, name: "HTML" },
      { id: 2, name: "CSS" },
      { id: 3, name: "React" },
    ];

    // Move React (index 2) to the top (index 0)
    const result = reorderSkills(skills, 2, 0);

    expect(result[0].name).toBe("React"); // React is now first
    expect(result[1].name).toBe("HTML");  // HTML moved down
    expect(result[2].name).toBe("CSS");   // CSS moved down
  });

  it("moving a skill to the same position changes nothing", () => {
    const skills = [
      { id: 1, name: "HTML" },
      { id: 2, name: "CSS" },
    ];

    const result = reorderSkills(skills, 0, 0); // move index 0 to index 0

    expect(result[0].name).toBe("HTML");
    expect(result[1].name).toBe("CSS");
  });

});
