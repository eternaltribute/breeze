export function calculateProfileCompletion({
  profile,
  skills,
  experiences,
  education,
  preferences,
}) {

const profileComplete =
  profile.firstName?.trim() &&
  profile.lastName?.trim() &&
  profile.email?.trim() &&
  profile.summary?.trim();

  const skillsComplete = skills.length > 0;

 const experienceComplete =
  experiences.length > 0;

 const educationComplete =
  education.length > 0;

 const preferencesComplete =
  preferences.targetRole?.trim() &&
  preferences.locationPreference?.trim() &&
  preferences.workMode?.trim();

  const completedSections = [
    profileComplete,
    skillsComplete,
    experienceComplete,
    educationComplete,
    preferencesComplete,
  ].filter(Boolean).length;

  const completion = Math.round(
    (completedSections / 5) * 100
  );

  const missingSections = [
    !profileComplete && "Identity & Contact",
    !skillsComplete && "Skills",
    !experienceComplete && "Experience",
    !educationComplete && "Education",
    !preferencesComplete && "Career Preferences",
  ].filter(Boolean);

  return {
    completion,
    missingSections,
    profileComplete,
    skillsComplete,
    experienceComplete,
    educationComplete,
    preferencesComplete,
  };
}