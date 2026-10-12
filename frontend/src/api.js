const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function request(path, options = {}, token) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("Could not connect to PocketSmart API. Make sure the backend is running.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.detail;
    throw new Error(Array.isArray(detail) ? detail.map((item) => item.msg).join(", ") : detail || "Something went wrong.");
  }
  return body;
}
