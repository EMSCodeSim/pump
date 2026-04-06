// js/legacySeed.js
import { Preferences } from '@capacitor/preferences';

/**
 * Release 1 (Legacy Seeding):
 * - Marks all current users as "legacyUser" so they will remain free forever.
 * - NO paywall logic in this release.
 *
 * Call this once at app startup.
 */
export async function seedLegacyUser(appVersion = 'unknown') {
  try {
    const { value } = await Preferences.get({ key: 'legacyUser' });

    // If already seeded, do nothing.
    if (value === 'true') return;

    // Mark as legacy (free forever)
    await Preferences.set({ key: 'legacyUser', value: 'true' });
    await Preferences.set({ key: 'legacySeededAt', value: String(Date.now()) });
    await Preferences.set({ key: 'legacyAppVersion', value: String(appVersion) });

    // Optional: also store an install timestamp for future analytics/debugging
    const { value: installTs } = await Preferences.get({ key: 'installTs' });
    if (!installTs) {
      await Preferences.set({ key: 'installTs', value: String(Date.now()) });
    }
  } catch (err) {
    // Never block app launch if storage fails
    console.warn('[LegacySeed] Failed to seed legacyUser:', err);
  }
}
