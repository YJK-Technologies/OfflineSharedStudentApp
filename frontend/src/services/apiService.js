/**
 * REST API Service using standard JavaScript fetch()
 * Note: Does NOT use Axios as strictly requested.
 */

// Normalize URL (ensure http:// prefix and remove trailing slash)
export function normalizeApiUrl(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) return '';
  let clean = rawUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(clean)) {
    clean = 'http://' + clean;
  }
  return clean;
}

// Determine API Base URL based on platform
export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    // 1. Check user-configured custom URL from localStorage
    const saved = localStorage.getItem('custom_api_url');
    if (saved && saved.trim()) {
      return normalizeApiUrl(saved);
    }
    // 2. Global window override
    if (window.__OVERRIDE_API_URL__) {
      return normalizeApiUrl(window.__OVERRIDE_API_URL__);
    }
  }

  // 3. Android Capacitor default (10.0.2.2 for emulator)
  const isAndroidNative = typeof window !== 'undefined' && 
    window.Capacitor && 
    typeof window.Capacitor.isNativePlatform === 'function' && 
    window.Capacitor.isNativePlatform();

  if (isAndroidNative) {
    return normalizeApiUrl(process.env.REACT_APP_ANDROID_API_URL || 'http://10.0.2.2:5000');
  }

  // 4. Windows Electron or Web Browser
  return normalizeApiUrl(process.env.REACT_APP_API_URL || 'http://localhost:5000');
}

export function setCustomApiUrl(url) {
  if (typeof window !== 'undefined') {
    const clean = normalizeApiUrl(url);
    if (clean) {
      localStorage.setItem('custom_api_url', clean);
    } else {
      localStorage.removeItem('custom_api_url');
    }
  }
}

/**
 * Detailed reachability check returning diagnostic error details
 */
export async function checkServerHealthDetailed(timeoutMs = 5000) {
  const baseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return { ok: true, url: baseUrl };
    }
    return { ok: false, url: baseUrl, error: `HTTP ${res.status} ${res.statusText}` };
  } catch (err) {
    clearTimeout(timeoutId);
    const reason = err && err.name === 'AbortError'
      ? 'Connection timed out (Windows Firewall may be blocking port 5000 or wrong IP)'
      : (err && err.message ? err.message : 'Network error');
    return { ok: false, url: baseUrl, error: reason };
  }
}

/**
 * Check genuine remote server reachability using health-check endpoint
 * (Guarantees actual server connectivity, unlike navigator.onLine which only checks local network interface)
 */
export async function checkServerHealth(timeoutMs = 5000) {
  const result = await checkServerHealthDetailed(timeoutMs);
  return result.ok;
}

/**
 * Push local changes to central server
 * POST /api/sync/push
 */
export async function pushRecordsToServer(records, deviceId) {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Device-Id': deviceId || 'client_app',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({
      deviceId: deviceId || 'client_app',
      records
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Push failed with HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * Pull changed records from central server
 * GET /api/sync/pull?cursor=...&limit=...
 */
export async function pullRecordsFromServer(cursor, limit = 100) {
  const baseUrl = getApiBaseUrl();
  const queryParams = new URLSearchParams({
    cursor: cursor || '1970-01-01T00:00:00.000Z',
    limit: limit.toString()
  });

  const res = await fetch(`${baseUrl}/api/sync/pull?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    }
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Pull failed with HTTP ${res.status}`);
  }

  return await res.json();
}
