export const PROFILE_PHOTO_UPDATED_EVENT = "breeze-profile-photo-updated";

async function getAuthHeaders(getToken) {
  const token = await getToken({ skipCache: true });
  return { Authorization: `Bearer ${token}` };
}

export async function fetchProfilePhoto(BASE, getToken) {
  const headers = await getAuthHeaders(getToken);
  const res = await fetch(`${BASE}/auth/profile/photo`, { headers });

  if (res.status === 404) return "";
  if (!res.ok) throw new Error("Failed to load profile photo");

  const data = await res.json();
  return data.profile_photo_url || "";
}

export async function uploadProfilePhoto(BASE, getToken, file) {
  const headers = await getAuthHeaders(getToken);
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE}/auth/profile/photo`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to upload profile photo");
  }

  const data = await res.json();
  window.dispatchEvent(new Event(PROFILE_PHOTO_UPDATED_EVENT));
  return data.profile_photo_url || "";
}

export async function deleteProfilePhoto(BASE, getToken) {
  const headers = await getAuthHeaders(getToken);
  const res = await fetch(`${BASE}/auth/profile/photo`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to remove profile photo");
  }

  window.dispatchEvent(new Event(PROFILE_PHOTO_UPDATED_EVENT));
}
