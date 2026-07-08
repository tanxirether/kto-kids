export const DISCLOSURE_STORAGE_KEY = 'monitoring_prominent_disclosure_v2';
export const ACCESSIBILITY_DISCLOSURE_KEY = 'accessibility_prominent_disclosure_v5';

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
 * Google Play Accessibility API policy — section headings MUST match Play Console
 * data-type labels exactly. Each entry: what is collected + purpose.
 */
export const ACCESSIBILITY_DISCLOSURE = {
  title: 'AccessibilityService API — required disclosure',
  bannerText:
    'REQUIRED: Read every data type below. K.T.O Kids uses the AccessibilityService API on this child device for parental monitoring.',
  sections: [
    {
      heading: 'All AccessibilityService API data types (read every item)',
      body:
        'K.T.O Kids collects or processes the following through the AccessibilityService API. Each item is explained in the sections below with purpose:\n\n' +
        '• Other actions\n' +
        '• Web browsing history\n' +
        '• Emails\n' +
        '• Precise location\n' +
        '• Crash logs\n' +
        '• SMS or MMS messages\n' +
        '• Name\n' +
        '• Email address\n' +
        '• Personal identifiers\n' +
        '• Address\n' +
        '• Phone number\n' +
        '• Other user-generated content\n\n' +
        'Data is shared with the linked parent/guardian account (K.T.O Parent App) and K.T.O servers. Not used for advertising or sold to third parties.',
    },
    {
      heading: 'Other actions',
      body:
        'K.T.O Kids uses the AccessibilityService API to perform other actions on this device: when a parent-blocked app is opened, or when a parent-set daily app time limit is exceeded, the app opens a blocking screen. Purpose: enforce parental app blocking and screen-time rules for the linked parent account. K.T.O Kids does not perform taps, swipes, purchases, or account changes without the user\'s knowledge.',
    },
    {
      heading: 'Web browsing history',
      body:
        'K.T.O Kids collects web browsing history data visible on the current browser screen (website or URL text shown in the address bar or on the page) through AccessibilityService API window and text-change events. Purpose: report website activity hints and browsing-related keyword alerts to the linked parent account. Saved browser history databases are not read.',
    },
    {
      heading: 'Emails',
      body:
        'K.T.O Kids collects email content that is visible on the device screen in a mail or messaging app through AccessibilityService API on-screen text events. Purpose: send keyword safety alerts to the linked parent when configured words appear in visible email content. Email inboxes and mail account databases are not accessed.',
    },
    {
      heading: 'Precise location',
      body:
        'K.T.O Kids does not collect precise location through the AccessibilityService API. Precise location is collected only when the separate Android Location permission is granted, to enable live location tracking for the linked parent account. Location permission has its own system prompt and parental consent flow, independent of Accessibility.',
    },
    {
      heading: 'Crash logs',
      body:
        'K.T.O Kids does not collect or upload crash logs through the AccessibilityService API. No crash log data is transmitted to the linked parent account or K.T.O servers. Any local service error messages remain on the device for debugging only.',
    },
    {
      heading: 'SMS or MMS messages',
      body:
        'K.T.O Kids collects SMS or MMS message text that is visible on the device screen through AccessibilityService API on-screen text events when a messaging app is open. Purpose: send keyword safety alerts to the linked parent when configured words appear in visible message content. SMS/MMS databases and message stores are not accessed.',
    },
    {
      heading: 'Name',
      body:
        'K.T.O Kids may collect a name when it appears as visible on-screen text included in a keyword alert snippet (up to 200 characters) through AccessibilityService API text events. Purpose: incidental inclusion in keyword safety alerts sent to the linked parent. Contact lists and account profiles are not accessed.',
    },
    {
      heading: 'Email address',
      body:
        'K.T.O Kids may collect an email address when it appears as visible on-screen text included in a keyword alert snippet through AccessibilityService API text events. Purpose: incidental inclusion in keyword safety alerts sent to the linked parent. Email account data is not accessed.',
    },
    {
      heading: 'Personal identifiers',
      body:
        'K.T.O Kids may collect personal identifiers (such as usernames or account IDs) when visible on screen and included in a keyword alert snippet through AccessibilityService API text events. Purpose: incidental inclusion in keyword safety alerts sent to the linked parent. Device account databases are not accessed.',
    },
    {
      heading: 'Address',
      body:
        'K.T.O Kids may collect an address when it appears as visible on-screen text included in a keyword alert snippet through AccessibilityService API text events. Purpose: incidental inclusion in keyword safety alerts sent to the linked parent. Stored address profiles are not accessed.',
    },
    {
      heading: 'Phone number',
      body:
        'K.T.O Kids may collect a phone number when it appears as visible on-screen text included in a keyword alert snippet through AccessibilityService API text events. Purpose: incidental inclusion in keyword safety alerts sent to the linked parent. Call logs and contact databases are not accessed.',
    },
    {
      heading: 'Other user-generated content',
      body:
        'K.T.O Kids collects other user-generated content — text the user types or sees on screen in apps (messages, posts, search terms, chat text, captions) through AccessibilityService API text-change and window content events. Up to 200 characters may be sent when a parent-configured keyword matches. Purpose: keyword safety alerts to the linked parent account.',
    },
    {
      heading: 'Your consent',
      body:
        'You must scroll through this entire disclosure, check the box below, and tap “I agree” before Android Accessibility settings open. Accessibility data collection begins only after you manually enable the K.T.O Kids Accessibility Service in settings. You may decline and exit without enabling Accessibility.',
    },
  ],
  checkboxLabel:
    'I have read the full AccessibilityService API disclosure above, including: Other actions, Web browsing history, Emails, Precise location, Crash logs, SMS or MMS messages, Name, Email address, Personal identifiers, Address, Phone number, and Other user-generated content. I consent to collection and sharing with the linked parent account as described.',
};
