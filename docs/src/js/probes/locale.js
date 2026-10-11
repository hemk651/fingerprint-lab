/**
 * Locale, language and time zone.
 *
 * Time zone is coarser than it looks but pairs strongly with locale: an
 * en-US browser on Asia/Kolkata is an unusual combination and narrows things
 * considerably. The offset alone leaks a band of longitude, not just a
 * preference.
 */
export const probe = {
  id: "locale",
  label: "Locale, language & time zone",
  family: "platform",
  bits: 3.2,
  async run() {
    const intl = Intl.DateTimeFormat().resolvedOptions();
    const now = new Date();
    return {
      language: navigator.language || null,
      languages: Array.isArray(navigator.languages) ? navigator.languages.slice() : null,
      intlLocale: intl.locale || null,
      calendar: intl.calendar || null,
      numberingSystem: intl.numberingSystem || null,
      timeZone: intl.timeZone || null,
      timeZoneOffsetMinutes: now.getTimezoneOffset(),
      dateFormatHint: new Intl.DateTimeFormat(intl.locale).format(now),
      weekInfo: typeof Intl.Locale === "function" && intl.locale
        ? (() => {
            try {
              const loc = new Intl.Locale(intl.locale);
              const week = loc.weekInfo || (loc.getWeekInfo && loc.getWeekInfo());
              return week ? { firstDay: week.firstDay, weekend: [week.weekend?.[0], week.weekend?.[week.weekend.length - 1]] } : null;
            } catch {
              return null;
            }
          })()
        : null,
    };
  },
};
