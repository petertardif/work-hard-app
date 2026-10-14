/**
 * Where the legal documents live.
 *
 * The drafts are in `legal/` at the repo root; host them and point these at the
 * published pages.
 *
 * App Store Review Guideline 5.1.1 requires a reachable privacy policy, and
 * Guideline 2.1 treats text referencing documents that do not exist as an
 * incomplete app. Both links must resolve before an archive is submitted.
 */
export const LegalUrls = {
  privacyPolicy: 'https://example.com/work-hard/privacy',
  termsOfService: 'https://example.com/work-hard/terms',
} as const;

/**
 * True once the placeholders above have been replaced.
 *
 * The sign-in screen hides the legal line entirely while this is false, so a
 * build can never ship links that 404 — a dead link is worse than no link.
 */
export const LegalUrlsConfigured = !Object.values(LegalUrls).some((url) =>
  url.includes('example.com'),
);
