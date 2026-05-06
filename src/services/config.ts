// Centralized API URL helpers. Use environment variables when available and
// fall back to relative paths to avoid breaking local/dev setups.
export const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL as string | undefined;
export const PUBLIC_ESTIMATOR_API_URL = "https://crm.cayadservices.com";

function joinBase(base: string | undefined, path: string) {
  if (!base || String(base).trim() === "") {
    // return a relative path
    return path.startsWith("/") ? path : `/${path}`;
  }
  const b = String(base).replace(/\/+$/, "");
  return path.startsWith("/") ? `${b}${path}` : `${b}/${path}`;
}

export function apiUrl(path: string) {
  return joinBase(PUBLIC_API_URL, path);
}

export function estimatorApiUrl(path: string) {
  return joinBase(PUBLIC_ESTIMATOR_API_URL, path);
}

export default {
  apiUrl,
  estimatorApiUrl,
};
