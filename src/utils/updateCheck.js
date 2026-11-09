/**
 * Checks GitHub Releases for a newer version. Used by the Android build,
 * which can't update itself the way the Docker image does.
 * Only full releases count (`/releases/latest` skips prereleases such as
 * the master-* builds).
 */

function parseVersion(v) {
  return String(v)
    .replace(/^v/, '')
    .split(/[.+-]/)
    .slice(0, 3)
    .map((n) => parseInt(n, 10) || 0);
}

/** @returns {number} >0 if a is newer than b */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * @returns {Promise<{ latest: string, hasUpdate: boolean, releaseUrl: string, apkUrl: string | null }>}
 */
export async function checkForUpdate(currentVersion = __APP_VERSION__, repo = __APP_REPO__) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
    const release = await res.json();
    const latest = String(release.tag_name || '').replace(/^v/, '');
    const apk = (release.assets || []).find((a) => /\.apk$/i.test(a.name));
    return {
      latest,
      hasUpdate: Boolean(latest) && compareVersions(latest, currentVersion) > 0,
      releaseUrl: release.html_url,
      apkUrl: apk?.browser_download_url ?? null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
