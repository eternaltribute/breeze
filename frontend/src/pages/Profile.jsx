import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Progress } from "@/components/ui/progress";

// dnd-kit imports — these power the drag-and-drop reordering
// DndContext: the "room" everything draggable lives inside
// closestCenter: the algorithm that decides where to drop something
// PointerSensor: detects mouse/touch drag gestures
// useSensor/useSensors: registers which input methods can trigger a drag
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
// arrayMove: a helper that takes an array and moves one item to a new position
// SortableContext: wraps the list and tells dnd-kit which items are sortable
// useSortable: gives one individual row its drag powers
// verticalListSortingStrategy: tells dnd-kit we're sorting a vertical list
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
// CSS.Transform.toString: converts dnd-kit's transform numbers into a CSS string
import { CSS } from "@dnd-kit/utilities";

const REQUIRED_FIELDS = ["firstName", "lastName", "email", "summary"];

const initialProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  summary: "",
};

function getCompletion(profile) {
  const filled = REQUIRED_FIELDS.filter((f) => profile[f].trim() !== "").length;
  return Math.round((filled / REQUIRED_FIELDS.length) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// SortableSkillRow
// This is a single row in the skills list.
// Think of it like a flashcard: it has a "front" (normal display mode)
// and a "back" (edit mode with dropdowns). Only one card can be flipped
// at a time.
//
// Props it receives:
//   skill          — the skill object { id, name, category, proficiency }
//   isEditing      — true if THIS row is currently flipped to edit mode
//   isAnyEditing   — true if ANY row is in edit mode (used to disable other buttons)
//   editValues     — the current draft values in the edit form
//   onEditStart    — called when the pencil button is clicked
//   onEditChange   — called when a dropdown changes in edit mode
//   onEditSave     — called when Save is clicked
//   onEditCancel   — called when Cancel is clicked
//   onDelete       — called when × is clicked
//   skillCategories — the grouped list of skills for the dropdown
// ─────────────────────────────────────────────────────────────────────────────
function SortableSkillRow({
  skill,
  isEditing,
  isAnyEditing,
  editValues,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
  skillCategories,
}) {
  // useSortable gives this specific row its drag-and-drop powers.
  // It needs the skill's id so dnd-kit can track which item is which.
  const {
    attributes,  // accessibility attributes (aria labels etc)
    listeners,   // event listeners that detect when a drag starts
    setNodeRef,  // connects this DOM element to dnd-kit's tracking system
    transform,   // how far this row has moved while being dragged (x/y numbers)
    transition,  // the CSS transition for smooth snapping animation
    isDragging,  // true while this specific row is being actively dragged
  } = useSortable({ id: skill.id });

  // Convert the transform numbers into an actual CSS transform string
  // e.g. transform becomes "translate3d(0px, 48px, 0)"
  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Fade slightly while dragging so it's clear which item is moving
    opacity: isDragging ? 0.5 : 1,
    // Sit on top of other rows while dragging
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...dragStyle,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 14px",
        borderRadius: "8px",
        // Use CSS variables so this works in both light and dark mode
        border: "1px solid var(--color-border-default, #d1d5db)",
        backgroundColor: "var(--bg-card, white)",
      }}
    >
      {/* ── DRAG HANDLE ──────────────────────────────────────────────────
          The ≡ symbol on the left side. Spreading ...attributes and
          ...listeners onto this div is what makes it draggable.
          We put the listeners here (not on the whole row) so that
          clicking Edit or × doesn't accidentally start a drag.
      ────────────────────────────────────────────────────────────────── */}
      <div
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        style={{
          cursor: "grab",
          color: "var(--color-subtext, #6b7280)",
          fontSize: "18px",
          padding: "0 4px",
          userSelect: "none",  // prevents text from being highlighted while dragging
          flexShrink: 0,       // keeps the handle from shrinking on small screens
          lineHeight: 1,
        }}
      >
        ≡
      </div>

      {/* ── NORMAL MODE: show skill name, category badge, proficiency badge ── */}
      {!isEditing && (
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}>
          <span style={{
            fontWeight: 600,
            fontSize: "14px",
            color: "var(--color-heading, #003C78)",
          }}>
            {skill.name}
          </span>

          {skill.category && (
            <span style={{
              fontSize: "12px",
              color: "var(--color-subtext, #6b7280)",
            }}>
              {skill.category}
            </span>
          )}

          {skill.proficiency && (
            <span style={{
              fontSize: "12px",
              padding: "2px 8px",
              borderRadius: "20px",
              backgroundColor: "var(--color-accent, #046A97)",
              color: "white",
            }}>
              {skill.proficiency}
            </span>
          )}
        </div>
      )}

      {/* ── EDIT MODE: show skill dropdown + proficiency dropdown ─────────
          This replaces the normal display when isEditing is true.
          The user can change both the skill name and the proficiency.
      ────────────────────────────────────────────────────────────────── */}
      {isEditing && (
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}>
          {/* Skill name dropdown — shows the same grouped options as + Add */}
          <select
            value={editValues.name}
            onChange={(e) => {
              const val = e.target.value;
              // Auto-assign the category when a skill is picked
              const cat = skillCategories.find((c) => c.skills.includes(val))?.label ?? "";
              onEditChange({ ...editValues, name: val, category: cat });
            }}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--color-border-default, #d1d5db)",
              fontSize: "13px",
              backgroundColor: "var(--bg-card, white)",
              color: "var(--color-heading, #003C78)",
              cursor: "pointer",
            }}
          >
            <option value="">Select skill...</option>
            {skillCategories.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.skills.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </optgroup>
            ))}
          </select>

          {/* Proficiency dropdown */}
          <select
            value={editValues.proficiency}
            onChange={(e) => onEditChange({ ...editValues, proficiency: e.target.value })}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--color-border-default, #d1d5db)",
              fontSize: "13px",
              backgroundColor: "var(--bg-card, white)",
              color: "var(--color-heading, #003C78)",
              cursor: "pointer",
            }}
          >
            <option value="">Proficiency...</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>
      )}

      {/* ── BUTTONS on the right side ────────────────────────────────────
          Normal mode: pencil (Edit) + red × (Delete)
          Edit mode: blue Save + grey Cancel
          When ANY row is in edit mode, the pencil and × on OTHER rows
          are disabled so only one edit can happen at a time.
      ────────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>

        {/* Normal mode buttons */}
        {!isEditing && (
          <>
            {/* Pencil button — title="Edit" creates the hover tooltip */}
            <button
              onClick={() => onEditStart(skill)}
              disabled={isAnyEditing}
              title="Edit"
              style={{
                background: "none",
                border: "none",
                cursor: isAnyEditing ? "not-allowed" : "pointer",
                color: isAnyEditing
                  ? "var(--color-subtext, #6b7280)"
                  : "var(--color-accent, #046A97)",
                fontSize: "15px",
                padding: "2px 6px",
                opacity: isAnyEditing ? 0.4 : 1,
                transition: "opacity 0.2s",
              }}
            >
              ✏
            </button>

            {/* Red × delete button */}
            <button
              onClick={() => onDelete(skill.id)}
              disabled={isAnyEditing}
              title="Delete"
              style={{
                background: "none",
                border: "none",
                cursor: isAnyEditing ? "not-allowed" : "pointer",
                color: isAnyEditing
                  ? "var(--color-subtext, #6b7280)"
                  : "var(--color-error, #FF6138)",
                fontSize: "18px",
                lineHeight: 1,
                opacity: isAnyEditing ? 0.4 : 1,
                transition: "opacity 0.2s",
              }}
            >
              ×
            </button>
          </>
        )}

        {/* Edit mode buttons */}
        {isEditing && (
          <>
            <button
              onClick={onEditSave}
              style={{
                backgroundColor: "var(--color-accent, #046A97)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save
            </button>

            <button
              onClick={onEditCancel}
              style={{
                backgroundColor: "transparent",
                color: "var(--color-subtext, #6b7280)",
                border: "1px solid var(--color-border-default, #d1d5db)",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile — the main page component
// Everything below is the same as before except the Skills section,
// which now uses SortableSkillRow + DndContext for drag-and-drop.
// ─────────────────────────────────────────────────────────────────────────────
function Profile() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [profile, setProfile] = useState(initialProfile);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});
  const [shaking, setShaking] = useState({});
  const [showBanner, setShowBanner] = useState(false);

  // ── Skills state ─────────────────────────────────────────────────────────
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState({ name: "", category: "", proficiency: "" });
  const [skillError, setSkillError] = useState("");
  const [skillsSaved, setSkillsSaved] = useState(false);

  // editingSkillId: stores the id of the skill row currently in edit mode.
  // null means no row is being edited. Think of it as "which flashcard is flipped over right now"
  const [editingSkillId, setEditingSkillId] = useState(null);

  // editValues: stores the draft values while a row is in edit mode.
  // When the user opens edit mode, we copy the skill's current values here.
  // If they cancel, we throw these away. If they save, we apply them.
  const [editValues, setEditValues] = useState({ name: "", category: "", proficiency: "" });

  // isAnyEditing: true if any row is currently open in edit mode.
  // We use this to disable the + Add button and other rows' buttons.
  const isAnyEditing = editingSkillId !== null;

  // ── Skill categories for the dropdowns ───────────────────────────────────
  const skillCategories = [
    {
      label: "Frontend",
      skills: ["HTML", "CSS", "JavaScript", "React", "TypeScript", "Tailwind CSS"],
    },
    {
      label: "Backend",
      skills: ["Python", "Node.js", "Java", "FastAPI", "Express", "PostgreSQL"],
    },
    {
      label: "Tools",
      skills: ["Git", "Docker", "GitHub Actions", "Figma", "Vite", "VS Code"],
    },
  ];

  // ── dnd-kit sensor setup ──────────────────────────────────────────────────
  // PointerSensor detects mouse and touch drags.
  // activationConstraint means you have to move 8px before a drag starts —
  // this prevents accidental drags when you just want to click a button.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // ── handleDragEnd ─────────────────────────────────────────────────────────
  // Called by dnd-kit when the user drops a dragged row.
  // active = the row that was dragged
  // over = the row it was dropped onto
  // arrayMove reorders the skills array: remove from old position, insert at new position
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return; // dropped in same spot, do nothing
    setSkills((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, oldIndex, newIndex); // returns a new reordered array
    });
    setSkillsSaved(false); // mark as unsaved since order changed
  };

  // ── Edit handlers ─────────────────────────────────────────────────────────

  // Called when pencil button is clicked — opens edit mode for that row
  const handleEditStart = (skill) => {
    setEditingSkillId(skill.id);
    // Copy the skill's current values into editValues so the dropdowns start pre-filled
    setEditValues({ name: skill.name, category: skill.category, proficiency: skill.proficiency });
  };

  // Called when Save is clicked in edit mode
  const handleEditSave = () => {
    if (!editValues.name) return; // don't save if no skill selected
    // Check for duplicates — but allow saving the same skill name as before
    const isDuplicate = skills.some(
      (s) => s.name === editValues.name && s.id !== editingSkillId
    );
    if (isDuplicate) return; // silently block (could add error message here)

    // Update the skills array: keep everything the same except the row being edited
    setSkills((prev) =>
      prev.map((s) =>
        s.id === editingSkillId
          ? { ...s, name: editValues.name, category: editValues.category, proficiency: editValues.proficiency }
          : s
      )
    );
    setEditingSkillId(null); // close edit mode
    setSkillsSaved(false);   // mark as unsaved
  };

  // Called when Cancel is clicked — just closes edit mode, no changes saved
  const handleEditCancel = () => {
    setEditingSkillId(null);
  };

  // ── Add / Delete handlers (unchanged from before) ────────────────────────
  const handleAddSkill = () => {
    if (!newSkill.name) return;
    if (skills.some((s) => s.name === newSkill.name)) {
      setSkillError("That skill is already in your list.");
      return;
    }
    setSkillError("");
    setSkillsSaved(false);
    setSkills([...skills, { id: Date.now(), ...newSkill }]);
    setNewSkill({ name: "", category: "", proficiency: "" });
  };

  const handleDeleteSkill = (id) => {
    setSkillsSaved(false);
    setSkills(skills.filter((s) => s.id !== id));
  };

  // ── Save Skills ───────────────────────────────────────────────────────────
  // TODO (Ronald): Build POST/PUT /profile/skills endpoint.
  // Expected request body shape:
  //   { skills: [ { name: string, category: string, proficiency: string, order: number } ] }
  // Expected response: 200 with updated skills array
  // The `order` field should be the index in the array (0, 1, 2...) to preserve drag order.
  // Auth: Bearer token via Authorization header (same pattern as PUT /auth/profile)
  const handleSaveSkills = async () => {
    // Placeholder until Ronald builds the endpoint
    console.log("Saving skills:", skills);
    setSkillsSaved(true);

    // When Ronald's endpoint is ready, replace the console.log above with:
    // try {
    //   const token = await getToken({ skipCache: true });
    //   const res = await fetch(`${BASE}/profile/skills`, {
    //     method: "PUT",
    //     headers: {
    //       Authorization: `Bearer ${token}`,
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({
    //       skills: skills.map((s, i) => ({ name: s.name, category: s.category, proficiency: s.proficiency, order: i })),
    //     }),
    //   });
    //   if (!res.ok) throw new Error("Skills save failed");
    //   setSkillsSaved(true);
    // } catch (err) {
    //   console.error(err);
    // }
  };

  const BASE = import.meta.env.VITE_API_BASE_URL;

  // ── Fetch profile on load ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await getToken({ skipCache: true });
        const res = await fetch(`${BASE}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProfile({
            firstName: data.first_name ?? "",
            lastName: data.last_name ?? "",
            email: data.email ?? "",
            phone: data.phone_number ?? "",
            summary: data.professional_summary ?? "",
          });
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    };
    fetchProfile();
  }, [BASE, getToken]);

  const completion = getCompletion(profile);

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length < 4) return digits;
    if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleChange = (e) => {
    setSaved(false);
    const value = e.target.name === "phone" ? formatPhone(e.target.value) : e.target.value;
    setProfile({ ...profile, [e.target.name]: value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!profile.firstName.trim()) newErrors.firstName = "First name is required.";
    if (!profile.lastName.trim()) newErrors.lastName = "Last name is required.";
    if (!profile.email.trim()) newErrors.email = "Email is required.";
    if (!profile.summary.trim()) newErrors.summary = "Professional summary is required.";
    const phoneDigits = profile.phone.replace(/\D/g, "");
    if (profile.phone && phoneDigits.length < 10) {
      newErrors.phone = "Please enter a complete 10-digit US phone number.";
    }
    return newErrors;
  };

  const triggerShake = (fields) => {
    const shakeMap = {};
    fields.forEach((f) => (shakeMap[f] = true));
    setShaking(shakeMap);
    setTimeout(() => setShaking({}), 600);
  };

  const handleSave = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setShowBanner(true);
      triggerShake(Object.keys(newErrors));
      return;
    }
    setErrors({});
    setShowBanner(false);
    try {
      const token = await getToken({ skipCache: true });
      const res = await fetch(`${BASE}/auth/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: profile.firstName,
          last_name: profile.lastName,
          email: profile.email,
          phone_number: profile.phone || null,
          professional_summary: profile.summary || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      await user.update({
        firstName: profile.firstName,
        lastName: profile.lastName,
      });
      setSaved(true);
    } catch (err) {
      console.error(err);
    }
  };

  const cardStyle = {
    backgroundColor: "var(--bg-card, white)",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  };

  const getInputStyle = (field) => ({
    ...inputStyle,
    border: errors[field]
      ? "1px solid var(--color-error, #FF6138)"
      : "1px solid var(--border, #d1d5db)",
    backgroundColor: errors[field] ? "rgba(255, 97, 56, 0.05)" : "white",
    animation: shaking[field] ? "shake 0.4s ease" : "none",
  });

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
      <div
        style={{
          backgroundColor: "var(--bg, #F8FAFC)",
          minHeight: "100vh",
          padding: "32px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: "700px" }}>

          {/* HEADER */}
          <h1 style={{
            color: "var(--color-heading, #003C78)",
            marginBottom: "12px",
            fontSize: "40px",
            lineHeight: "1.2",
            fontWeight: 700,
          }}>
            My Profile
          </h1>

          <p style={{
            color: "var(--color-subtext, #6b7280)",
            marginBottom: "28px",
            fontSize: "16px",
            lineHeight: "1.5",
          }}>
            Keep your profile up to date to get the best results!
          </p>

          {/* VALIDATION BANNER */}
          {showBanner && (
            <div style={{
              backgroundColor: "rgba(255, 97, 56, 0.08)",
              border: "1px solid var(--color-error, #FF6138)",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "24px",
              color: "var(--color-error, #FF6138)",
              fontSize: "14px",
              fontWeight: 500,
            }}>
              * Please complete all required fields before saving.
            </div>
          )}

          {/* COMPLETION CARD */}
          <div style={{ ...cardStyle, borderLeft: "4px solid var(--color-accent, #046A97)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontWeight: 600, color: "var(--color-heading, #003C78)" }}>
                Profile Completion
              </span>
              <span style={{
                fontWeight: 600,
                color: completion === 100
                  ? "var(--color-accent, #046A97)"
                  : "var(--color-error, #FF6138)",
              }}>
                {completion}%
              </span>
            </div>
            <Progress value={completion} />
            <p style={{ marginTop: "10px", fontSize: "12px", color: "var(--color-subtext, #6b7280)" }}>
              {completion === 100
                ? "Your profile is complete! 🎉"
                : `Fill in ${
                    REQUIRED_FIELDS.length -
                    REQUIRED_FIELDS.filter((f) => profile[f].trim() !== "").length
                  } more required field(s) to complete your profile.`}
            </p>
          </div>

          {/* IDENTITY & CONTACT — unchanged */}
          <div style={cardStyle}>
            <h2 style={{ color: "var(--color-heading, #003C78)", fontSize: "16px", marginBottom: "16px" }}>
              Identity & Contact
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>First Name *</label>
                <input name="firstName" value={profile.firstName} onChange={handleChange} placeholder="Jane" style={getInputStyle("firstName")} />
                {errors.firstName && <p style={errorTextStyle}>{errors.firstName}</p>}
              </div>
              <div>
                <label style={labelStyle}>Last Name *</label>
                <input name="lastName" value={profile.lastName} onChange={handleChange} placeholder="Doe" style={getInputStyle("lastName")} />
                {errors.lastName && <p style={errorTextStyle}>{errors.lastName}</p>}
              </div>
            </div>
            <div style={{ marginTop: "16px" }}>
              <label style={labelStyle}>Email *</label>
              <input name="email" value={profile.email} onChange={handleChange} placeholder="jane@example.com" style={getInputStyle("email")} />
              {errors.email && <p style={errorTextStyle}>{errors.email}</p>}
            </div>
            <div style={{ marginTop: "16px" }}>
              <label style={labelStyle}>Phone</label>
              <input name="phone" value={profile.phone} onChange={handleChange} placeholder="(555) 000-0000" style={getInputStyle("phone")} />
              {errors.phone && <p style={errorTextStyle}>{errors.phone}</p>}
            </div>
          </div>

          {/* SUMMARY — unchanged */}
          <div style={cardStyle}>
            <h2 style={{ color: "var(--color-heading, #003C78)", fontSize: "16px", marginBottom: "16px" }}>
              Professional Summary *
            </h2>
            <textarea
              name="summary"
              value={profile.summary}
              onChange={handleChange}
              placeholder="Tell us about yourself and your career goals..."
              rows={5}
              style={{ ...getInputStyle("summary"), resize: "vertical", minHeight: "120px" }}
            />
            {errors.summary && <p style={errorTextStyle}>{errors.summary}</p>}
          </div>

          {/* ── SKILLS CARD ──────────────────────────────────────────────────
              This is the updated section. Everything above is unchanged.
              Key concepts:
              - DndContext wraps the whole draggable area
              - SortableContext tells dnd-kit which items are in the list
              - Each SortableSkillRow is one draggable row
          ────────────────────────────────────────────────────────────────── */}
          <div style={cardStyle}>
            <h2 style={{ color: "var(--color-heading, #003C78)", fontSize: "16px", marginBottom: "16px" }}>
              Skills
            </h2>

            {/* ── ADD NEW SKILL ROW ────────────────────────────────────────
                The + Add button is disabled while any row is in edit mode.
                isAnyEditing controls this — if it's true, the button is
                greyed out and won't respond to clicks.
            ─────────────────────────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              <select
                value={newSkill.name}
                disabled={isAnyEditing}
                onChange={(e) => {
                  const val = e.target.value;
                  const cat = skillCategories.find((c) => c.skills.includes(val))?.label ?? "";
                  setNewSkill({ ...newSkill, name: val, category: cat });
                }}
                style={{
                  ...inputStyle,
                  opacity: isAnyEditing ? 0.4 : 1,
                  cursor: isAnyEditing ? "not-allowed" : "pointer",
                }}
              >
                <option value="">Select a skill...</option>
                {skillCategories.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.skills.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <select
                value={newSkill.proficiency}
                disabled={isAnyEditing}
                onChange={(e) => setNewSkill({ ...newSkill, proficiency: e.target.value })}
                style={{
                  ...inputStyle,
                  maxWidth: "180px",
                  opacity: isAnyEditing ? 0.4 : 1,
                  cursor: isAnyEditing ? "not-allowed" : "pointer",
                }}
              >
                <option value="">Proficiency...</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>

              <button
                onClick={handleAddSkill}
                disabled={isAnyEditing}
                style={{
                  backgroundColor: isAnyEditing ? "var(--color-subtext, #6b7280)" : "var(--brand-deep, #003C78)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: isAnyEditing ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  opacity: isAnyEditing ? 0.5 : 1,
                  transition: "opacity 0.2s, background-color 0.2s",
                }}
              >
                + Add
              </button>
            </div>

            {skillError && (
              <p style={{ color: "var(--color-error, #FF6138)", fontSize: "13px", marginBottom: "12px" }}>
                {skillError}
              </p>
            )}

            {/* ── DRAGGABLE SKILLS LIST ─────────────────────────────────────
                DndContext: the container that manages all drag events.
                  - sensors: how drags are detected (pointer/touch)
                  - collisionDetection: the algorithm for deciding where to drop
                  - onDragEnd: what happens when the user lets go

                SortableContext: tells dnd-kit the ordered list of draggable ids.
                  - items: array of ids in current order
                  - strategy: verticalListSortingStrategy for up/down lists

                Each SortableSkillRow gets:
                  - isEditing: true only if this row's id matches editingSkillId
                  - isAnyEditing: true if any row is being edited
            ─────────────────────────────────────────────────────────────── */}
            {skills.length === 0 ? (
              <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "14px" }}>
                No skills added yet.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={skills.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {skills.map((skill) => (
                    <SortableSkillRow
                      key={skill.id}
                      skill={skill}
                      isEditing={editingSkillId === skill.id}
                      isAnyEditing={isAnyEditing}
                      editValues={editValues}
                      onEditStart={handleEditStart}
                      onEditChange={setEditValues}
                      onEditSave={handleEditSave}
                      onEditCancel={handleEditCancel}
                      onDelete={handleDeleteSkill}
                      skillCategories={skillCategories}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}

            {/* Save Skills button */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "16px" }}>
              <button
                onClick={handleSaveSkills}
                style={{
                  backgroundColor: "var(--brand-deep, #003C78)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 24px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save Skills
              </button>
              {skillsSaved && (
                <span style={{ color: "var(--color-accent, #046A97)", fontSize: "14px" }}>
                  ✓ Skills saved!
                </span>
              )}
            </div>
          </div>

          {/* SAVE PROFILE BUTTON — unchanged */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <button
              onClick={handleSave}
              style={{
                backgroundColor: "var(--brand-deep, #003C78)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save Profile
            </button>
            {saved && (
              <span style={{ color: "#22c55e", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                ✓ Profile saved!
              </span>
            )}
            {showBanner && !saved && (
              <span style={{ color: "var(--color-error, #FF6138)", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                ✕ Please fill out all required fields.
              </span>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

export default Profile;

/* ===== Reusable styles ===== */

const labelStyle = {
  fontSize: "13px",
  color: "var(--color-label, #cbd5e1)",
  fontWeight: 500,
};

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: "4px",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border, #d1d5db)",
  fontSize: "14px",
  boxSizing: "border-box",
};

const errorTextStyle = {
  color: "var(--color-error, #FF6138)",
  fontSize: "12px",
  marginTop: "4px",
};