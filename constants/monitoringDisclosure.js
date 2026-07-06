export const DISCLOSURE_STORAGE_KEY = 'monitoring_prominent_disclosure_v2';
export const ACCESSIBILITY_DISCLOSURE_KEY = 'accessibility_prominent_disclosure_v4';

export const MONITORING_DISCLOSURE = {
  title: 'Parental monitoring — required disclosure',
  bannerText:
    'K.T.O Kids is a parental monitoring tool. A parent or legal guardian must consent before this app collects or shares device data.',
  sections: [
    {
      heading: 'What this app is',
      body:
        'K.T.O Kids is installed on a child\'s Android device and pairs with the K.T.O Parent App. It is a monitoring tool — not a standalone app — used for lawful parental supervision with guardian consent.',
    },
    {
      heading: 'Who receives your data',
      body:
        'Data collected on this device is transmitted to the linked parent/guardian account (K.T.O Parent App) and to K.T.O servers to operate monitoring features. Data is not sold to third parties for advertising.',
    },
    {
      heading: 'Data this app may collect (with consent)',
      body:
        '• Foreground app names and app usage duration\n' +
        '• Device location (when location permission is enabled — not via Accessibility)\n' +
        '• Photos from the device camera (when enabled by the parent)\n' +
        '• Microphone audio (when enabled by the parent)\n' +
        '• Screen content during parent-initiated screen sharing (after on-device consent)\n' +
        '• Keyword safety alerts when configured text appears on screen\n' +
        '• Device and app status needed to keep monitoring active',
    },
    {
      heading: 'Accessibility Service (separate required disclosure)',
      body:
        'Before you enable Accessibility, K.T.O Kids shows a separate full-screen disclosure that lists every data type collected through the AccessibilityService API and the purpose for each. You must read and accept that disclosure before Accessibility settings open.',
    },
    {
      heading: 'Your consent',
      body:
        'You must read this disclosure and tap “I agree” before K.T.O Kids requests sensitive permissions or begins monitoring. You may decline and exit setup. A parent or legal guardian must authorize monitoring on this device.',
    },
  ],
  checkboxLabel:
    'I confirm I am the device owner or have permission from a parent/guardian. I have read this disclosure and consent to parental monitoring and data collection as described.',
};

/**
 * Google Play Accessibility API policy: each declared data type must be named
 * explicitly with collection method + purpose (User Data / prominent disclosure).
 */
export const ACCESSIBILITY_DISCLOSURE = {
  title: 'AccessibilityService API — required disclosure',
  bannerText:
    'K.T.O Kids uses the Android AccessibilityService API on this child device. Read below: every data type accessed through this API, how it is collected, and why.',
  sections: [
    {
      heading: 'Summary',
      body:
        'K.T.O Kids accesses data through the AccessibilityService API only after you enable the K.T.O Kids Accessibility Service in Android settings. Data is sent to the linked parent/guardian account (K.T.O Parent App) and K.T.O servers for parental monitoring and child safety. Data is not used for advertising or sold to third parties.',
    },
    {
      heading: 'Web browsing history',
      body:
        'What: Website or URL text visible on the current browser screen (for example a domain shown in the address bar or on the page).\n' +
        'How collected: Read from on-screen text while a browser app is in the foreground through AccessibilityService API window and text-change events.\n' +
        'Purpose: To report website activity hints and browsing-related keyword alerts to the linked parent account.\n' +
        'Note: Saved browser history databases and offline history files are not read.',
    },
    {
      heading: 'Other user-generated content',
      body:
        'What: Text the user types or sees on screen in apps (messages, posts, search terms, captions, chat text, and similar content).\n' +
        'How collected: Read from on-screen text through AccessibilityService API text-change and window content events; up to 200 characters may be included when a parent-configured keyword matches.\n' +
        'Purpose: To send keyword safety alerts to the linked parent account when configured words or phrases appear on screen.',
    },
    {
      heading: 'Emails',
      body:
        'What: Email message text visible on the device screen in a mail or messaging app.\n' +
        'How collected: Read from on-screen text through AccessibilityService API when visible on screen; not read from email inboxes, accounts, or mail databases.\n' +
        'Purpose: To send keyword safety alerts to the linked parent when configured words appear in visible email content.',
    },
    {
      heading: 'SMS or MMS messages',
      body:
        'What: SMS or MMS message text visible on the device screen.\n' +
        'How collected: Read from on-screen text through AccessibilityService API when a messaging app is open; SMS/MMS databases and message stores are not accessed.\n' +
        'Purpose: To send keyword safety alerts to the linked parent when configured words appear in visible message content.',
    },
    {
      heading: 'Name',
      body:
        'What: A person\'s name if it appears as visible on-screen text.\n' +
        'How collected: Read from on-screen text through AccessibilityService API only when included in a keyword alert snippet; contact lists and account profiles are not accessed.\n' +
        'Purpose: Included only incidentally in keyword safety alert snippets sent to the linked parent account.',
    },
    {
      heading: 'Email address',
      body:
        'What: An email address if it appears as visible on-screen text.\n' +
        'How collected: Read from on-screen text through AccessibilityService API only when included in a keyword alert snippet; email account data is not accessed.\n' +
        'Purpose: Included only incidentally in keyword safety alert snippets sent to the linked parent account.',
    },
    {
      heading: 'Phone number',
      body:
        'What: A phone number if it appears as visible on-screen text.\n' +
        'How collected: Read from on-screen text through AccessibilityService API only when included in a keyword alert snippet; call logs and contact databases are not accessed.\n' +
        'Purpose: Included only incidentally in keyword safety alert snippets sent to the linked parent account.',
    },
    {
      heading: 'Address',
      body:
        'What: A postal or physical address if it appears as visible on-screen text.\n' +
        'How collected: Read from on-screen text through AccessibilityService API only when included in a keyword alert snippet; stored address profiles are not accessed.\n' +
        'Purpose: Included only incidentally in keyword safety alert snippets sent to the linked parent account.',
    },
    {
      heading: 'Personal identifiers',
      body:
        'What: Identifiers visible on screen (for example usernames, account IDs, or similar text shown in an app).\n' +
        'How collected: Read from on-screen text through AccessibilityService API only when included in a keyword alert snippet; device account databases are not accessed.\n' +
        'Purpose: Included only incidentally in keyword safety alert snippets sent to the linked parent account.',
    },
    {
      heading: 'App activity (foreground apps and usage time)',
      body:
        'What: Which app is in the foreground and how long apps are used.\n' +
        'How collected: Through AccessibilityService API window state change events.\n' +
        'Purpose: To provide app usage reports, activity timelines, and screen-time limits to the linked parent account.',
    },
    {
      heading: 'Other actions',
      body:
        'What: Device actions performed by K.T.O Kids through the AccessibilityService API.\n' +
        'How used: When a parent-blocked app is opened, or when a parent-set daily app time limit is exceeded, K.T.O Kids opens a blocking screen on this device.\n' +
        'Purpose: To enforce parental app blocking and screen-time rules set by the linked parent account.\n' +
        'K.T.O Kids does not use Accessibility to perform taps, swipes, purchases, password entry, or account changes without the user\'s knowledge.',
    },
    {
      heading: 'Precise location — not collected through AccessibilityService API',
      body:
        'K.T.O Kids does not collect precise location through the AccessibilityService API. Location is collected only when the separate Android Location permission is granted, with its own permission prompt and parental consent flow.',
    },
    {
      heading: 'Crash logs — not collected through AccessibilityService API',
      body:
        'K.T.O Kids does not collect or upload crash logs through the AccessibilityService API. Any local service error messages remain on the device for debugging only and are not transmitted to the parent account or K.T.O servers.',
    },
    {
      heading: 'Your consent',
      body:
        'You must read this disclosure and tap “I agree” below before Android Accessibility settings open. Accessibility data collection begins only after you manually enable the K.T.O Kids Accessibility Service in settings. You may decline and exit without enabling Accessibility.',
    },
  ],
  checkboxLabel:
    'I have read this AccessibilityService API disclosure. I consent to K.T.O Kids collecting and sharing the data types described above (including web browsing history visible on screen, other user-generated content, emails and SMS/MMS text visible on screen, personal information visible in keyword snippets, app activity, and blocking actions) with the linked parent account for parental monitoring.',
};
