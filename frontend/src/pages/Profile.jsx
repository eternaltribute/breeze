import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Progress } from "@/components/ui/progress";
import {
  PencilLine,
  Building2,
  MapPin,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
} from "lucide-react";
// dnd-kit imports — these power the drag-and-drop reordering
// DndContext: the "room" everything draggable lives inside
// closestCenter: the algorithm that decides where to drop something
// PointerSensor: detects mouse/touch drag gestures
// useSensor/useSensors: registers which input methods can trigger a drag
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
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

function SortableExperience({ exp, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: exp.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: {
          ...attributes,
          ...listeners,
        },
      })}
    </div>
  );
}
function SortableEducation({ exp, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: exp.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: {
          ...attributes,
          ...listeners,
        },
      })}
    </div>
  );
}
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
    attributes, // accessibility attributes (aria labels etc)
    listeners, // event listeners that detect when a drag starts
    setNodeRef, // connects this DOM element to dnd-kit's tracking system
    transform, // how far this row has moved while being dragged (x/y numbers)
    transition, // the CSS transition for smooth snapping animation
    isDragging, // true while this specific row is being actively dragged
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
        borderRadius: "10px",
        border: "2px solid #f59e0b",
        backgroundColor: "var(--bg-card, white)",
        marginBottom: "12px",
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
          color: "#f59e0b",
          fontSize: "18px",
          padding: "0 4px",
          userSelect: "none",
          flexShrink: 0,
          lineHeight: 1,
          fontWeight: "bold",
        }}
      >
        ≡
      </div>

      {/* ── NORMAL MODE: show skill name, category badge, proficiency badge ── */}
      {!isEditing && (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--color-heading, #003C78)",
            }}
          >
            {skill.name}
          </span>

          {skill.category && (
            <span
              style={{
                fontSize: "12px",
                color: "var(--color-subtext, #6b7280)",
              }}
            >
              {skill.category}
            </span>
          )}

          {skill.proficiency && (
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "20px",
                backgroundColor: "var(--color-accent, #046A97)",
                color: "white",
              }}
            >
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
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {/* Skill name dropdown — shows the same grouped options as + Add */}
          <select
            value={editValues.name}
            onChange={(e) => {
              const val = e.target.value;
              // Auto-assign the category when a skill is picked
              const group = skillCategories.find((c) => c.skills.includes(val));
              const cat = group ? group.label : editValues.category;
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
                  <option key={s} value={s}>
                    {s}
                  </option>
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
                color: isAnyEditing ? "var(--color-subtext)" : "var(--color-accent)",
                padding: "2px 6px",
                opacity: isAnyEditing ? 0.4 : 1,
                transition: "opacity 0.2s, transform 0.15s",
              }}
            >
              <PencilLine size={16} />
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
              X
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
              Done
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

function Profile() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [profile, setProfile] = useState(initialProfile);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});
  const [shaking, setShaking] = useState({});
  const [showBanner, setShowBanner] = useState(false);
  const [showClearProfileConfirm, setShowClearProfileConfirm] = useState(false);
  const handleClearProfile = async () => {
    try {
      const token = await getToken({ skipCache: true });

      const clearedProfile = {
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        professional_summary: "",
      };

      await fetch(`${BASE}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(clearedProfile),
      });

      setProfile({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        summary: "",
      });

      setSaved(true);
      setShowClearProfileConfirm(false);
    } catch (error) {
      console.error(error);
    }
  };

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
  const canSaveSkills = skills.length > 0 && !isAnyEditing && !skillsSaved;
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

  const handleEditStart = (skill) => {
    setSkillsSaved(false);

    setEditingSkillId(skill.id);

    setEditValues({
      name: skill.name,
      category: skill.category,
      proficiency: skill.proficiency,
    });
  };

  // Called when Save is clicked in edit mode
  const handleEditSave = () => {
    if (!editValues.name) return; // don't save if no skill selected
    // Check for duplicates — but allow saving the same skill name as before
    const isDuplicate = skills.some((s) => s.name === editValues.name && s.id !== editingSkillId);
    if (isDuplicate) return; // silently block (could add error message here)

    // Update the skills array: keep everything the same except the row being edited
    setSkills((prev) =>
      prev.map((s) =>
        s.id === editingSkillId
          ? {
              ...s,
              name: editValues.name,
              category: editValues.category,
              proficiency: editValues.proficiency,
            }
          : s
      )
    );
    setEditingSkillId(null); // close edit mode
    setSkillsSaved(false); // mark as unsaved
  };

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
  // ── Experiences ──────────────────────────────────────────
  const [experiences, setExperiences] = useState([]);
  const [experienceErrors, setExperienceErrors] = useState({});
  const [experienceSaved, setExperienceSaved] = useState(false);
  const [confirmDeleteExperienceId, setConfirmDeleteExperienceId] = useState(null);
  const handleExperienceDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setExperiences((prev) => {
      const oldIndex = prev.findIndex((e) => e.id === active.id);
      const newIndex = prev.findIndex((e) => e.id === over.id);

      return arrayMove(prev, oldIndex, newIndex);
    });

    setExperienceSaved(false);
  };
  const handleAddExperience = () => {
    setExperiences([
      ...experiences,
      {
        id: crypto.randomUUID(),
        title: "",
        company: "",
        city: "",
        state: "",
        startDate: "",
        endDate: "",
        description: "",
        saved: false,
        collapsed: false,
        hasStartedEditing: false,
      },
    ]);
  };
  const validateExperience = (exp) => {
    const errors = {};

    if (!exp.title.trim()) errors.title = "Job Title is required.";
    if (!exp.company.trim()) errors.company = "Company is required.";
    if (!exp.city.trim()) {
      errors.city = "City is required";
    }

    if (!exp.state.trim()) {
      errors.state = "State is required";
    }
    if (!exp.startDate) errors.startDate = "Start date is required.";
    if (!exp.endDate) errors.endDate = "End date is required.";
    if (!exp.description.trim()) errors.description = "Description is required.";

    if (exp.startDate && exp.endDate && new Date(exp.endDate) < new Date(exp.startDate)) {
      errors.endDate = "End date cannot be earlier than start date.";
    }
    return errors;
  };
  const updateExperience = (id, field, value) => {
    setExperienceSaved(false);

    setExperiences((prev) =>
      prev.map((exp) => {
        if (exp.id !== id) return exp;

        const updated = {
          ...exp,
          [field]: value,
          hasStartedEditing: true,
        };

        const errors = validateExperience(updated);

        setExperienceErrors((prevErrors) => ({
          ...prevErrors,
          [id]: errors,
        }));

        return updated;
      })
    );
  };

  const deleteExperience = (id) => {
    setExperiences((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSaveExperiences = () => {
    const errors = {};

    experiences.forEach((exp) => {
      const fieldErrors = {};

      if (!exp.title.trim()) {
        fieldErrors.title = "Job Title is required.";
      }

      if (!exp.company.trim()) {
        fieldErrors.company = "Company is required.";
      }
      if (!exp.city.trim()) {
        fieldErrors.city = "City is required.";
      }

      if (!exp.state.trim()) {
        fieldErrors.state = "State is required.";
      }
      if (!exp.startDate) {
        fieldErrors.startDate = "Start date is required.";
      }

      if (!exp.endDate) {
        fieldErrors.endDate = "End date is required.";
      }

      if (!exp.description.trim()) {
        fieldErrors.description = "Description is required.";
      }

      if (exp.startDate && exp.endDate && new Date(exp.endDate) < new Date(exp.startDate)) {
        fieldErrors.endDate = "End date cannot be earlier than start date.";
      }

      if (Object.keys(fieldErrors).length > 0) {
        errors[exp.id] = fieldErrors;
      }
    });

    setExperienceErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    console.log("Saving experiences:", experiences);
    setExperienceSaved(true);
    setExperiences(
      experiences.map((exp) => ({
        ...exp,
        saved: true,
        collapsed: true,
      }))
    );
  };

  // ── Education ──────────────────────────────────────────
  const [education, setEducation] = useState([]);
  const [educationErrors, setEducationErrors] = useState({});
  const [educationSaved, setEducationSaved] = useState(false);
  const [confirmDeleteEducationId, setConfirmDeleteEducationId] = useState(null);
  const handleEducationDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setEducation((prev) => {
      const oldIndex = prev.findIndex((e) => e.id === active.id);
      const newIndex = prev.findIndex((e) => e.id === over.id);

      return arrayMove(prev, oldIndex, newIndex);
    });

    setEducationSaved(false);
  };
  const handleAddEducation = () => {
    setEducation([
      ...education,
      {
        id: crypto.randomUUID(),
        school: "",
        degree: "",
        fieldOfStudy: "",
        startDate: "",
        endDate: "",
        saved: false,
        collapsed: false,
        hasStartedEditing: false,
      },
    ]);
  };

  const validateEducation = (edu) => {
    const errors = {};

    if (!edu.school.trim()) {
      errors.school = "School is required.";
    }

    if (!edu.degree.trim()) {
      errors.degree = "Degree is required.";
    }
    if (!edu.fieldOfStudy.trim()) {
      errors.fieldOfStudy = "Field of study is required.";
    }
    if (!edu.startDate) {
      errors.startDate = "Start date is required.";
    }

    if (!edu.endDate) {
      errors.endDate = "End date is required.";
    }

    if (edu.startDate && edu.endDate && new Date(edu.endDate) < new Date(edu.startDate)) {
      errors.endDate = "End date cannot be earlier than start date.";
    }

    return errors;
  };

  const updateEducation = (id, field, value) => {
    setEducationSaved(false);

    setEducation((prev) =>
      prev.map((edu) => {
        if (edu.id !== id) return edu;

        const updated = {
          ...edu,
          [field]: value,
          hasStartedEditing: true,
        };

        const errors = validateEducation(updated);

        setEducationErrors((prevErrors) => ({
          ...prevErrors,
          [id]: errors,
        }));

        return updated;
      })
    );
  };
  const deleteEducation = (id) => {
    setEducation((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSaveEducation = () => {
    const errors = {};

    education.forEach((edu) => {
      const fieldErrors = validateEducation(edu);

      if (Object.keys(fieldErrors).length > 0) {
        errors[edu.id] = fieldErrors;
      }
    });

    setEducationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setEducationSaved(true);

    setEducation(
      education.map((edu) => ({
        ...edu,
        saved: true,
        collapsed: true,
      }))
    );
  };
  const hasOpenEducation = education.some((edu) => !edu.collapsed);

  const canSaveEducation =
    hasOpenEducation &&
    education.length > 0 &&
    education.every(
      (edu) =>
        edu.school.trim() &&
        edu.degree.trim() &&
        edu.fieldOfStudy.trim() &&
        edu.startDate &&
        edu.endDate
    );

  const hasOpenExperience = experiences.some((exp) => !exp.collapsed);
  const openExperience = experiences.find((exp) => !exp.collapsed);
  const canSaveExperiences =
    experiences.length > 0 &&
    experiences.every(
      (exp) =>
        exp.title.trim() &&
        exp.company.trim() &&
        exp.city.trim() &&
        exp.state.trim() &&
        exp.startDate &&
        exp.endDate &&
        exp.description.trim()
    );
  const formatDate = (dateString) => {
    if (!dateString) return "";

    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // ----  Career Preferences -----------------------

  const [preferences, setPreferences] = useState({
    targetRole: "",
    locationPreference: "",
    workMode: "",
    salaryPreference: "",
  });

  const [preferencesErrors, setPreferencesErrors] = useState({});
  const [preferencesCompleted, setPreferencesCompleted] = useState(false);
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [savedPreferences, setSavedPreferences] = useState({
    targetRole: "",
    locationPreference: "",
    workMode: "",
    salaryPreference: "",
  });
  const validatePreferences = () => {
    const errors = {};

    if (!preferences.targetRole.trim()) {
      errors.targetRole = "Target role is required";
    }

    if (!preferences.locationPreference.trim()) {
      errors.locationPreference = "Location is required";
    } else if (!/^[A-Za-z\s]+,\s*[A-Za-z]{2}$/.test(preferences.locationPreference.trim())) {
      errors.locationPreference = "Use format: City, ST (e.g. Newark, NJ)";
    }

    if (!preferences.workMode) {
      errors.workMode = "Please select a work mode";
    }

    if (!preferences.salaryPreference) {
      errors.salaryPreference = "Salary preference is required";
    } else if (Number(preferences.salaryPreference) < 15000) {
      errors.salaryPreference = "Salary must be at least $15,000";
    } else if (Number(preferences.salaryPreference) > 1000000) {
      errors.salaryPreference = "Please enter a realistic salary amount";
    }

    return errors;
  };

  const handleSavePreferences = async () => {
    const errors = validatePreferences();

    if (Object.keys(errors).length > 0) {
      setPreferencesErrors(errors);
      return;
    }

    setPreferencesErrors({});

    try {
      // save to backend

      setSavedPreferences({ ...preferences });
      setPreferencesCompleted(true);
      setPreferencesSaved(true);
      setIsEditingPreferences(false);

      setTimeout(() => {
        setPreferencesSaved(false);
      }, 3000);
    } catch (error) {
      console.error(error);
    }
  };
  const [confirmClear, setConfirmClear] = useState(false);

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
    backgroundColor: errors[field] ? "rgba(255, 97, 56, 0.05)" : "var(--color-input-bg)",
    animation: shaking[field] ? "shake 0.4s ease" : "none",
  });

  // PROFILE SECTION
  const profileComplete =
    profile.firstName?.trim() &&
    profile.lastName?.trim() &&
    profile.email?.trim() &&
    profile.summary?.trim();

  // SKILLS SECTION
  const skillsComplete = skillsSaved && skills.length > 0;

  // EXPERIENCE SECTION
  const experienceComplete = experienceSaved && experiences.length > 0;
  // EDUCATION SECTION
  const educationComplete = educationSaved && education.length > 0;
  // CAREER SECTION
  const preferencesComplete =
    preferencesCompleted &&
    preferences.targetRole?.trim() &&
    preferences.locationPreference?.trim() &&
    preferences.workMode?.trim();

  // COMPLETION %
  const completedSections = [
    profileComplete,
    skillsComplete,
    experienceComplete,
    educationComplete,
    preferencesComplete,
  ].filter(Boolean).length;

  const completion = Math.round((completedSections / 5) * 100);

  // MISSING SECTIONS
  const missingSections = [
    !profileComplete && "Identity & Contact",
    !skillsComplete && "Skills",
    !experienceComplete && "Experience",
    !educationComplete && "Education",
    !preferencesComplete && "Career Preferences",
  ].filter(Boolean);

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
          <h1
            style={{
              color: "var(--color-heading, #003C78)",
              marginBottom: "12px",
              fontSize: "40px",
              lineHeight: "1.2",
              fontWeight: 700,
            }}
          >
            My Profile
          </h1>

          <p
            style={{
              color: "var(--color-subtext, #6b7280)",
              marginBottom: "28px",
              fontSize: "16px",
              lineHeight: "1.5",
            }}
          >
            Keep your profile up to date to get the best results!
          </p>

          {/* VALIDATION BANNER */}
          {showBanner && (
            <div
              style={{
                backgroundColor: "rgba(255, 97, 56, 0.08)",
                border: "1px solid var(--color-error, #FF6138)",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "24px",
                color: "var(--color-error, #FF6138)",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              * Please complete all required fields before saving.
            </div>
          )}

          {/* COMPLETION CARD */}
          <div style={{ ...cardStyle, borderLeft: "4px solid var(--section-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontWeight: 600, color: "var(--color-heading, #003C78)" }}>
                Profile Completion
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color:
                    completion === 100
                      ? "var(--color-accent, #046A97)"
                      : "var(--color-error, #FF6138)",
                }}
              >
                {completion}%
              </span>
            </div>
            <Progress value={completion} />
            <p
              style={{
                marginTop: "10px",
                fontSize: "12px",
                color: "var(--color-subtext, #6b7280)",
              }}
            >
              {completion === 100 ? (
                "Your profile is complete! 🎉"
              ) : (
                <>Missing: {missingSections.join(", ")}</>
              )}
            </p>
          </div>

          {/* IDENTITY & CONTACT */}
          <div
            style={{
              ...cardStyle,
              borderLeft: "4px solid var(--section-border)",
            }}
          >
            <h2
              style={{
                color: "var(--color-heading, #003C78)",
                fontSize: "16px",
                marginBottom: "16px",
              }}
            >
              Identity & Contact *
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>First Name *</label>
                <input
                  name="firstName"
                  value={profile.firstName}
                  onChange={handleChange}
                  placeholder="Jane"
                  style={getInputStyle("firstName")}
                />
                {errors.firstName && <p style={errorTextStyle}>{errors.firstName}</p>}
              </div>
              <div>
                <label style={labelStyle}>Last Name *</label>
                <input
                  name="lastName"
                  value={profile.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  style={getInputStyle("lastName")}
                />
                {errors.lastName && <p style={errorTextStyle}>{errors.lastName}</p>}
              </div>
            </div>
            <div style={{ marginTop: "16px" }}>
              <label style={labelStyle}>Email *</label>
              <input
                name="email"
                value={profile.email}
                onChange={handleChange}
                placeholder="jane@example.com"
                style={getInputStyle("email")}
              />
              {errors.email && <p style={errorTextStyle}>{errors.email}</p>}
            </div>
            <div style={{ marginTop: "16px" }}>
              <label style={labelStyle}>Phone</label>

              <div
                style={{
                  position: "relative",
                  marginTop: "4px",
                }}
              >
                <input
                  name="phone"
                  value={profile.phone}
                  onChange={handleChange}
                  placeholder="(000) 000-0000"
                  style={{
                    ...getInputStyle("phone"),
                    paddingLeft: "12px",
                  }}
                />
              </div>

              {errors.phone && <p style={errorTextStyle}>{errors.phone}</p>}
            </div>

            {/* Divider */}
            <hr
              style={{
                border: "none",
                borderTop: "1px solid var(--border)",
                margin: "24px 0",
              }}
            />
            {/* SUMMARY */}
            <div>
              <label style={labelStyle}>Professional Summary *</label>
              <textarea
                name="summary"
                value={profile.summary}
                onChange={handleChange}
                placeholder="Tell us about yourself and your career goals..."
                rows={5}
                style={{
                  ...getInputStyle("summary"),
                  resize: "vertical",
                  minHeight: "120px",
                }}
              />
              {errors.summary && <p style={errorTextStyle}>{errors.summary}</p>}
            </div>
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
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
                Save Profile Information
              </button>
            </div>
          </div>

          {/* SKILLS */}
          <div
            style={{
              ...cardStyle,
              borderLeft: "4px solid var(--section-border)",
            }}
          >
            <h2
              style={{
                color: "var(--color-heading, #003C78)",
                fontSize: "16px",
                marginBottom: "16px",
              }}
            >
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
                      <option key={s} value={s}>
                        {s}
                      </option>
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
                disabled={isAnyEditing || !newSkill.name || !newSkill.proficiency}
                style={{
                  backgroundColor:
                    isAnyEditing || !newSkill.name || !newSkill.proficiency
                      ? "var(--color-border-default, #d1d5db)"
                      : "var(--brand-deep, #003C78)",

                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 600,

                  cursor: isAnyEditing
                    ? "not-allowed"
                    : !newSkill.name || !newSkill.proficiency
                      ? "not-allowed"
                      : "pointer",

                  opacity: isAnyEditing ? 0.5 : !newSkill.name || !newSkill.proficiency ? 0.7 : 1,

                  whiteSpace: "nowrap",
                  transition: "opacity 0.2s, background-color 0.2s",
                }}
              >
                + Add
              </button>
            </div>
            {!newSkill.name || !newSkill.proficiency ? (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--color-subtext, #6b7280)",
                  marginTop: "8px",
                }}
              >
                Choose both a skill and proficiency before adding.
              </p>
            ) : null}
            {skillError && (
              <p
                style={{
                  color: "var(--color-error, #FF6138)",
                  fontSize: "13px",
                  marginBottom: "12px",
                }}
              >
                {skillError}
              </p>
            )}
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
                disabled={!canSaveSkills}
                style={{
                  backgroundColor: canSaveSkills
                    ? "var(--brand-deep, #003C78)"
                    : "var(--color-border-default, #d1d5db)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 24px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: canSaveSkills ? "pointer" : "not-allowed",
                  opacity: canSaveSkills ? 1 : 0.7,
                }}
              >
                Save Skills
              </button>
              {skillsSaved && !isAnyEditing && (
                <span
                  style={{
                    color: "#22c55e",
                    backgroundColor: "rgba(34, 197, 94, 0.12)",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  ✓ Skills saved!
                </span>
              )}
            </div>
          </div>

          {/* EXPERIENCE */}
          <div
            style={{
              ...cardStyle,
              borderLeft: "4px solid var(--section-border)",
            }}
          >
            <h2
              style={{
                color: "var(--color-heading, #003C78)",
                fontSize: "16px",
                marginBottom: "16px",
              }}
            >
              Experience
            </h2>

            <button
              onClick={handleAddExperience}
              disabled={hasOpenExperience}
              style={{
                backgroundColor: hasOpenExperience
                  ? "var(--color-border-default, #d1d5db)"
                  : "var(--brand-deep, #003C78)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                cursor: hasOpenExperience ? "not-allowed" : "pointer",
                opacity: hasOpenExperience ? 0.7 : 1,
                marginBottom: "16px",
              }}
            >
              + Add Experience
            </button>
            {hasOpenExperience && (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--color-subtext)",
                  marginBottom: "12px",
                }}
              >
                Save or finish editing the current experience before adding another.
              </p>
            )}
            {experiences.length === 0 ? (
              <p
                style={{
                  color: "var(--color-subtext, #6b7280)",
                }}
              >
                No experience entries yet.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleExperienceDragEnd}
              >
                <SortableContext
                  items={experiences.map((e) => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {experiences.map((exp) => {
                    return (
                      <SortableExperience key={exp.id} exp={exp}>
                        {({ dragHandleProps }) =>
                          exp.collapsed ? (
                            <div
                              style={{
                                border: "2px solid #f59e0b",
                                borderRadius: "14px",
                                padding: "20px",
                                marginBottom: "16px",
                                backgroundColor: "var(--color-card-bg)",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <span
                                    {...dragHandleProps}
                                    title="Drag to reorder"
                                    style={{
                                      cursor: "grab",
                                      fontSize: "18px",
                                      color: "var(--color-subtext)",
                                      userSelect: "none",
                                    }}
                                  >
                                    ☰
                                  </span>

                                  <h3
                                    style={{
                                      margin: 0,
                                      color: "var(--color-heading)",
                                      fontSize: "22px",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {exp.title || "Untitled Position"}
                                  </h3>
                                </div>

                                {exp.saved && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      padding: "8px 14px",
                                      borderRadius: "999px",
                                      backgroundColor: "rgba(245, 158, 11, 0.12)",
                                      color: "#d97706",
                                      border: "1px solid rgba(245, 158, 11, 0.25)",
                                      fontSize: "13px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    <CheckCircle2 size={16} />
                                    Saved
                                  </span>
                                )}
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  gap: "20px",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  marginTop: "16px",
                                  color: "var(--color-subtext)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  <Building2 size={16} />
                                  <span>{exp.company}</span>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  <MapPin size={16} />
                                  <span>
                                    {exp.city}, {exp.state}
                                  </span>
                                </div>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  marginTop: "14px",
                                  color: "var(--color-subtext)",
                                  fontSize: "14px",
                                }}
                              >
                                <CalendarDays size={16} />
                                <span>
                                  {formatDate(exp.startDate)} – {formatDate(exp.endDate)}
                                </span>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  marginTop: "20px",
                                }}
                              >
                                {" "}
                                <button
                                  disabled={hasOpenExperience && exp.collapsed}
                                  onClick={() => {
                                    setExperienceSaved(false);
                                    updateExperience(exp.id, "collapsed", false);
                                  }}
                                  style={{
                                    backgroundColor: openExperience
                                      ? "#94a3b8"
                                      : "var(--brand-deep)",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "8px 14px",
                                    cursor: openExperience ? "not-allowed" : "pointer",
                                    opacity: openExperience ? 0.7 : 1,
                                  }}
                                >
                                  Edit
                                </button>
                                {confirmDeleteExperienceId !== exp.id ? (
                                  <button
                                    onClick={() => setConfirmDeleteExperienceId(exp.id)}
                                    style={{
                                      backgroundColor: "#FF6138",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "8px",
                                      padding: "8px 14px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "6px",
                                      alignItems: "center",
                                    }}
                                  >
                                    <button
                                      onClick={() => {
                                        deleteExperience(exp.id);
                                        setConfirmDeleteExperienceId(null);
                                      }}
                                      style={{
                                        backgroundColor: "#FF6138",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "8px 10px",
                                        fontSize: "12px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Confirm
                                    </button>

                                    <button
                                      onClick={() => setConfirmDeleteExperienceId(null)}
                                      style={{
                                        backgroundColor: "#6b7280",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "8px 10px",
                                        fontSize: "12px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                border: "2px solid #f59e0b",
                                borderRadius: "10px",
                                padding: "16px",
                                marginBottom: "16px",
                                backgroundColor: "var(--color-card-bg)",
                              }}
                            >
                              <label style={labelStyle}>Job Title *</label>
                              <input
                                placeholder="Job Title"
                                value={exp.title}
                                onChange={(e) => updateExperience(exp.id, "title", e.target.value)}
                                style={inputStyle}
                              />

                              {exp.hasStartedEditing && experienceErrors[exp.id]?.title && (
                                <p style={errorTextStyle}>{experienceErrors[exp.id].title}</p>
                              )}
                              <label style={labelStyle}>Company *</label>
                              <input
                                placeholder="Company"
                                value={exp.company}
                                onChange={(e) =>
                                  updateExperience(exp.id, "company", e.target.value)
                                }
                                style={inputStyle}
                              />

                              {exp.hasStartedEditing && experienceErrors[exp.id]?.company && (
                                <p style={errorTextStyle}>{experienceErrors[exp.id].company}</p>
                              )}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label style={labelStyle}>City *</label>
                                  <input
                                    value={exp.city}
                                    onChange={(e) =>
                                      updateExperience(exp.id, "city", e.target.value)
                                    }
                                    placeholder="Newark"
                                    style={inputStyle}
                                  />

                                  {exp.hasStartedEditing && experienceErrors[exp.id]?.city && (
                                    <p style={errorTextStyle}>{experienceErrors[exp.id].city}</p>
                                  )}
                                </div>

                                <div>
                                  <label style={labelStyle}>State *</label>
                                  <input
                                    value={exp.state}
                                    onChange={(e) =>
                                      updateExperience(
                                        exp.id,
                                        "state",
                                        e.target.value.toUpperCase().slice(0, 2)
                                      )
                                    }
                                    placeholder="NJ"
                                    maxLength={2}
                                    style={inputStyle}
                                  />

                                  {exp.hasStartedEditing && experienceErrors[exp.id]?.state && (
                                    <p style={errorTextStyle}>{experienceErrors[exp.id].state}</p>
                                  )}
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: "16px",
                                  marginTop: "12px",
                                }}
                              >
                                <div>
                                  <label
                                    style={{
                                      ...labelStyle,
                                      display: "block",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    Start Date *
                                  </label>
                                  <input
                                    type="date"
                                    value={exp.startDate}
                                    onChange={(e) =>
                                      updateExperience(exp.id, "startDate", e.target.value)
                                    }
                                    style={inputStyle}
                                  />
                                  {exp.hasStartedEditing && experienceErrors[exp.id]?.startDate && (
                                    <p style={errorTextStyle}>
                                      {experienceErrors[exp.id].startDate}
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <label
                                    style={{
                                      ...labelStyle,
                                      display: "block",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    End Date *
                                  </label>

                                  <input
                                    type="date"
                                    value={exp.endDate}
                                    onChange={(e) =>
                                      updateExperience(exp.id, "endDate", e.target.value)
                                    }
                                    style={inputStyle}
                                  />
                                  {exp.hasStartedEditing && experienceErrors[exp.id]?.endDate && (
                                    <p style={errorTextStyle}>{experienceErrors[exp.id].endDate}</p>
                                  )}
                                </div>
                              </div>

                              <label style={labelStyle}>Describe your responsibilities *</label>
                              <textarea
                                value={exp.description}
                                onChange={(e) =>
                                  updateExperience(exp.id, "description", e.target.value)
                                }
                                rows={4}
                                style={{
                                  ...inputStyle,
                                  marginTop: "10px",
                                }}
                              />
                              {exp.hasStartedEditing && experienceErrors[exp.id]?.description && (
                                <p style={errorTextStyle}>{experienceErrors[exp.id].description}</p>
                              )}

                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  marginTop: "12px",
                                  flexWrap: "wrap",
                                }}
                              >
                                {confirmDeleteExperienceId !== exp.id ? (
                                  <button
                                    onClick={() => setConfirmDeleteExperienceId(exp.id)}
                                    style={{
                                      backgroundColor: "#FF6138",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "8px",
                                      padding: "10px 16px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        deleteExperience(exp.id);
                                        setConfirmDeleteExperienceId(null);
                                      }}
                                      style={{
                                        backgroundColor: "#FF6138",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "10px 16px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Confirm Delete
                                    </button>

                                    <button
                                      onClick={() => setConfirmDeleteExperienceId(null)}
                                      style={{
                                        backgroundColor: "#6b7280",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "10px 16px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        }
                      </SortableExperience>
                    );
                  })}
                </SortableContext>
              </DndContext>
            )}

            <div style={{ marginTop: "16px" }}>
              <button
                onClick={handleSaveExperiences}
                disabled={!canSaveExperiences}
                style={{
                  backgroundColor: canSaveExperiences
                    ? "var(--brand-deep, #003C78)"
                    : "var(--color-border-default, #d1d5db)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  cursor: canSaveExperiences ? "pointer" : "not-allowed",
                  opacity: canSaveExperiences ? 1 : 0.7,
                }}
              >
                Save Experience
              </button>
              {!canSaveExperiences && experiences.length > 0 && (
                <p
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    color: "var(--color-subtext)",
                  }}
                >
                  Complete all experience fields before saving.
                </p>
              )}
            </div>
          </div>

          {/* EDUCATION */}
          <div
            style={{
              ...cardStyle,
              borderLeft: "4px solid var(--section-border)",
            }}
          >
            <h2
              style={{
                color: "var(--color-heading, #003C78)",
                fontSize: "16px",
                marginBottom: "16px",
              }}
            >
              Education
            </h2>

            <button
              onClick={handleAddEducation}
              disabled={hasOpenEducation}
              style={{
                backgroundColor: hasOpenEducation
                  ? "var(--color-border-default, #d1d5db)"
                  : "var(--brand-deep, #003C78)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                cursor: hasOpenEducation ? "not-allowed" : "pointer",
                opacity: hasOpenEducation ? 0.7 : 1,
                marginBottom: "16px",
              }}
            >
              + Add Education
            </button>
            {hasOpenEducation && (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--color-subtext)",
                  marginBottom: "12px",
                }}
              >
                Save or finish editing the current education before adding another.
              </p>
            )}
            {education.length === 0 ? (
              <p
                style={{
                  color: "var(--color-subtext, #6b7280)",
                }}
              >
                No education entries yet.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleEducationDragEnd}
              >
                <SortableContext
                  items={education.map((e) => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {education.map((exp) => {
                    return (
                      <SortableEducation key={exp.id} exp={exp}>
                        {({ dragHandleProps }) =>
                          exp.collapsed ? (
                            <div
                              style={{
                                border: "2px solid #f59e0b",
                                borderRadius: "14px",
                                padding: "20px",
                                marginBottom: "16px",
                                backgroundColor: "var(--color-card-bg)",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <span
                                    {...dragHandleProps}
                                    title="Drag to reorder"
                                    style={{
                                      cursor: "grab",
                                      fontSize: "18px",
                                      color: "var(--color-subtext)",
                                    }}
                                  >
                                    ☰
                                  </span>

                                  <h3
                                    style={{
                                      margin: 0,
                                      color: "var(--color-heading)",
                                      fontSize: "20px",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {exp.degree || "Untitled Degree"}
                                  </h3>
                                </div>

                                {exp.saved && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      padding: "8px 14px",
                                      borderRadius: "999px",
                                      backgroundColor: "rgba(245, 158, 11, 0.12)",
                                      color: "#d97706",
                                      border: "1px solid rgba(245, 158, 11, 0.25)",
                                      fontSize: "13px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    <CheckCircle2 size={16} />
                                    Saved
                                  </span>
                                )}
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  gap: "20px",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  marginTop: "16px",
                                  color: "var(--color-subtext)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  <GraduationCap size={16} />
                                  <span style={{ fontWeight: 500 }}>{exp.school}</span>
                                </div>

                                <div>{exp.fieldOfStudy}</div>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  marginTop: "14px",
                                  color: "var(--color-subtext)",
                                  fontSize: "14px",
                                }}
                              >
                                <CalendarDays size={16} />
                                <span>
                                  {formatDate(exp.startDate)} – {formatDate(exp.endDate)}
                                </span>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  marginTop: "12px",
                                }}
                              >
                                {" "}
                                <button
                                  disabled={hasOpenEducation && exp.collapsed}
                                  onClick={() => {
                                    setEducationSaved(false);
                                    updateEducation(exp.id, "collapsed", false);
                                  }}
                                  style={{
                                    backgroundColor: hasOpenEducation
                                      ? "#94a3b8"
                                      : "var(--brand-deep)",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "8px 14px",
                                    cursor: hasOpenEducation ? "not-allowed" : "pointer",
                                    opacity: hasOpenEducation ? 0.7 : 1,
                                  }}
                                >
                                  Edit
                                </button>
                                {confirmDeleteEducationId !== exp.id ? (
                                  <button
                                    onClick={() => setConfirmDeleteEducationId(exp.id)}
                                    style={{
                                      backgroundColor: "#FF6138",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "8px",
                                      padding: "8px 14px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "6px",
                                      alignItems: "center",
                                    }}
                                  >
                                    <button
                                      onClick={() => {
                                        deleteEducation(exp.id);
                                        setConfirmDeleteEducationId(null);
                                      }}
                                      style={{
                                        backgroundColor: "#FF6138",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "8px 10px",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                      }}
                                    >
                                      Confirm
                                    </button>

                                    <button
                                      onClick={() => setConfirmDeleteEducationId(null)}
                                      style={{
                                        backgroundColor: "#6b7280",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "8px 10px",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                border: "2px solid #f59e0b",
                                borderRadius: "10px",
                                padding: "16px",
                                marginBottom: "16px",
                                backgroundColor: "var(--color-card-bg)",
                              }}
                            >
                              <label style={labelStyle}>Degree *</label>
                              <input
                                placeholder="Degree"
                                value={exp.degree}
                                onChange={(e) => updateEducation(exp.id, "degree", e.target.value)}
                                style={inputStyle}
                              />

                              {exp.hasStartedEditing && educationErrors[exp.id]?.degree && (
                                <p style={errorTextStyle}>{educationErrors[exp.id].degree}</p>
                              )}
                              <label style={labelStyle}>School *</label>
                              <input
                                placeholder="School"
                                value={exp.school}
                                onChange={(e) => updateEducation(exp.id, "school", e.target.value)}
                                style={inputStyle}
                              />

                              {exp.hasStartedEditing && educationErrors[exp.id]?.school && (
                                <p style={errorTextStyle}>{educationErrors[exp.id].school}</p>
                              )}
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: "16px",
                                  marginTop: "12px",
                                }}
                              >
                                <div>
                                  <label
                                    style={{
                                      ...labelStyle,
                                      display: "block",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    Start Date *
                                  </label>
                                  <input
                                    type="date"
                                    value={exp.startDate}
                                    onChange={(e) =>
                                      updateEducation(exp.id, "startDate", e.target.value)
                                    }
                                    style={inputStyle}
                                  />
                                  {exp.hasStartedEditing && educationErrors[exp.id]?.startDate && (
                                    <p style={errorTextStyle}>
                                      {educationErrors[exp.id].startDate}
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <label
                                    style={{
                                      ...labelStyle,
                                      display: "block",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    End Date *
                                  </label>

                                  <input
                                    type="date"
                                    value={exp.endDate}
                                    onChange={(e) =>
                                      updateEducation(exp.id, "endDate", e.target.value)
                                    }
                                    style={inputStyle}
                                  />
                                  {exp.hasStartedEditing && educationErrors[exp.id]?.endDate && (
                                    <p style={errorTextStyle}>{educationErrors[exp.id].endDate}</p>
                                  )}
                                </div>
                              </div>

                              <label style={labelStyle}>Field of study *</label>
                              <input
                                placeholder="Computer Science"
                                value={exp.fieldOfStudy}
                                onChange={(e) =>
                                  updateEducation(exp.id, "fieldOfStudy", e.target.value)
                                }
                                style={inputStyle}
                              />
                              {exp.hasStartedEditing && educationErrors[exp.id]?.fieldOfStudy && (
                                <p style={errorTextStyle}>{educationErrors[exp.id].fieldOfStudy}</p>
                              )}

                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  marginTop: "12px",
                                  flexWrap: "wrap",
                                }}
                              >
                                {confirmDeleteEducationId !== exp.id ? (
                                  <button
                                    onClick={() => setConfirmDeleteEducationId(exp.id)}
                                    style={{
                                      backgroundColor: "#FF6138",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "8px",
                                      padding: "8px 14px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "6px",
                                      alignItems: "center",
                                    }}
                                  >
                                    <button
                                      onClick={() => {
                                        deleteEducation(exp.id);
                                        setConfirmDeleteEducationId(null);
                                      }}
                                      style={{
                                        backgroundColor: "#FF6138",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "8px 10px",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                      }}
                                    >
                                      Confirm
                                    </button>

                                    <button
                                      onClick={() => setConfirmDeleteEducationId(null)}
                                      style={{
                                        backgroundColor: "#6b7280",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "8px 10px",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        }
                      </SortableEducation>
                    );
                  })}
                </SortableContext>
              </DndContext>
            )}

            <div style={{ marginTop: "16px" }}>
              <button
                onClick={handleSaveEducation}
                disabled={!canSaveEducation}
                style={{
                  backgroundColor: canSaveEducation
                    ? "var(--brand-deep, #003C78)"
                    : "var(--color-border-default, #d1d5db)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  cursor: canSaveEducation ? "pointer" : "not-allowed",
                  opacity: canSaveEducation ? 1 : 0.7,
                }}
              >
                Save Education
              </button>
              {!canSaveEducation && education.length > 0 && (
                <p
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    color: "var(--color-subtext)",
                  }}
                >
                  Complete all education fields before saving.
                </p>
              )}
            </div>
          </div>

          {/* CAREER PREFERENCES */}
          <div
            style={{
              ...cardStyle,
              borderLeft: "4px solid var(--section-border)",
            }}
          >
            <h2
              style={{
                color: "var(--color-heading, #003C78)",
                fontSize: "16px",
                marginBottom: "16px",
              }}
            >
              Career Preferences
            </h2>

            {/* VIEW MODE */}
            {!isEditingPreferences ? (
              <div
                style={{
                  border: "2px solid #f59e0b",
                  borderRadius: "14px",
                  padding: "18px",
                  backgroundColor: "var(--color-card-bg)",
                }}
              >
                {/* HEADER ROW */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "14px",
                  }}
                >
                  {preferencesSaved && (
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: "999px",
                        backgroundColor: "rgba(4, 106, 153, 0.12)",
                        color: "var(--color-accent, #046A97)",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      ✓ Saved
                    </span>
                  )}
                </div>

                {/* CONTENT GRID */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px 20px",
                    fontSize: "14px",
                    color: "var(--color-subtext)",
                  }}
                >
                  <div>
                    <strong style={{ color: "var(--color-heading)" }}>Target Role:</strong>
                    <div>{preferences.targetRole || "Not specified"}</div>
                  </div>

                  <div>
                    <strong style={{ color: "var(--color-heading)" }}>Location:</strong>
                    <div>{preferences.locationPreference || "Not specified"}</div>
                  </div>

                  <div>
                    <strong style={{ color: "var(--color-heading)" }}>Work Mode:</strong>
                    <div>{preferences.workMode || "Not specified"}</div>
                  </div>

                  <div>
                    <strong style={{ color: "var(--color-heading)" }}>Salary:</strong>
                    <div>
                      {preferences.salaryPreference
                        ? `$${Number(preferences.salaryPreference).toLocaleString()}`
                        : "Not specified"}
                    </div>
                  </div>
                </div>

                {/* ACTIONS ROW */}
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "14px",
                  }}
                >
                  <button
                    onClick={() => {
                      setSavedPreferences({ ...preferences });
                      setIsEditingPreferences(true);
                    }}
                    style={{
                      backgroundColor: "var(--brand-deep, #003C78)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>

                  {!confirmClear ? (
                    <button
                      onClick={() => setConfirmClear(true)}
                      style={{
                        backgroundColor: "#FF6138",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px 14px",
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => {
                          setPreferences({
                            targetRole: "",
                            locationPreference: "",
                            workMode: "",
                            salaryPreference: "",
                          });
                          setConfirmClear(false);
                        }}
                        style={{
                          backgroundColor: "#FF6138",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px 10px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        Confirm
                      </button>

                      <button
                        onClick={() => setConfirmClear(false)}
                        style={{
                          backgroundColor: "#6b7280",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px 10px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* EDIT MODE */
              <div>
                <label style={labelStyle}>Target Role *</label>
                <input
                  type="text"
                  placeholder="Software Developer"
                  value={preferences.targetRole}
                  onChange={(e) => {
                    setPreferences({
                      ...preferences,
                      targetRole: e.target.value,
                    });

                    setPreferencesErrors((prev) => ({
                      ...prev,
                      targetRole: "",
                    }));
                  }}
                  style={inputStyle}
                />
                {preferencesErrors.targetRole && (
                  <p style={errorTextStyle}>{preferencesErrors.targetRole}</p>
                )}

                <label style={labelStyle}>Location (City, State) *</label>
                <input
                  type="text"
                  placeholder="Newark, NJ"
                  value={preferences.locationPreference}
                  onChange={(e) => {
                    setPreferences({
                      ...preferences,
                      locationPreference: e.target.value,
                    });

                    setPreferencesErrors((prev) => ({
                      ...prev,
                      locationPreference: "",
                    }));
                  }}
                  style={inputStyle}
                />
                {preferencesErrors.locationPreference && (
                  <p style={errorTextStyle}>{preferencesErrors.locationPreference}</p>
                )}

                <label style={labelStyle}>Work Mode *</label>
                <select
                  value={preferences.workMode}
                  onChange={(e) => {
                    setPreferences({
                      ...preferences,
                      workMode: e.target.value,
                    });

                    setPreferencesErrors((prev) => ({
                      ...prev,
                      workMode: "",
                    }));
                  }}
                  style={inputStyle}
                >
                  <option value="">Select Work Mode</option>
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="On-site">On-site</option>
                </select>

                {preferencesErrors.workMode && (
                  <p style={errorTextStyle}>{preferencesErrors.workMode}</p>
                )}

                <label style={labelStyle}>Salary *</label>
                <input
                  type="number"
                  min="15000"
                  step="1000"
                  placeholder="e.g. 75000"
                  value={preferences.salaryPreference}
                  onChange={(e) => {
                    setPreferences({
                      ...preferences,
                      salaryPreference: e.target.value,
                    });

                    setPreferencesErrors((prev) => ({
                      ...prev,
                      salaryPreference: "",
                    }));
                  }}
                  style={inputStyle}
                />

                {preferencesErrors.salaryPreference && (
                  <p style={errorTextStyle}>{preferencesErrors.salaryPreference}</p>
                )}

                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <button
                    onClick={handleSavePreferences}
                    style={{
                      backgroundColor: "var(--brand-deep, #003C78)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      cursor: "pointer",
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setPreferences({ ...savedPreferences });
                      setIsEditingPreferences(false);
                      setPreferencesErrors({});
                      setConfirmClear(false);
                    }}
                    style={{
                      backgroundColor: "#6b7280",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
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
  border: "1px solid var(--border)",
  fontSize: "14px",
  boxSizing: "border-box",

  backgroundColor: "var(--color-input-bg)",
  color: "var(--color-input-text)",
};

const errorTextStyle = {
  color: "var(--color-error, #FF6138)",
  fontSize: "12px",
  marginTop: "4px",
};
