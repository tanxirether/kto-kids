export const DISCLOSURE_STORAGE_KEY = 'monitoring_prominent_disclosure_v2';
export const ACCESSIBILITY_DISCLOSURE_KEY = 'accessibility_prominent_disclosure_v7';

/** Exact labels from Google Play Accessibility rejection — must appear in UI text. */
export const GOOGLE_ACCESSIBILITY_DATA_TYPES = [
  'Other actions',
  'Web browsing history',
  'Emails',
  'Precise location',
  'Crash logs',
  'SMS or MMS messages',
  'Name',
  'Email address',
  'Personal identifiers',
  'Address',
  'Phone number',
  'Other user-generated content',
];

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
        'Before you enable Accessibility, K.T.O Kids shows a separate full-screen AccessibilityService API disclosure that lists every data type and purpose. You must accept that disclosure before Accessibility settings open.',
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
 * Prominent disclosure for AccessibilityService API (Google Play User Data policy).
 * Each Google-declared data type has its own heading with collection + purpose.
 */
export const ACCESSIBILITY_DISCLOSURE = {
  title: 'AccessibilityService API — data use disclosure',
  bannerText:
    'This prominent disclosure explains what data K.T.O Kids collects using the AccessibilityService API and for what purpose. Scroll and read every data type before continuing.',
  dataTypesLabel: 'Data types covered in this disclosure',
  dataTypes: GOOGLE_ACCESSIBILITY_DATA_TYPES,
  sections: [
    {
      heading: 'Purpose of AccessibilityService API',
      body:
        'K.T.O Kids uses the AccessibilityService API for parental control and child safety on a child device paired with the K.T.O Parent App.\n\n' +
        'With parent/guardian consent, the AccessibilityService API is used to detect opened apps, monitor app usage, detect screen interactions, and process visible on-screen text to identify unsafe content, web activity, messages, searches, and restricted app activity.\n\n' +
        'This data is used to show parents activity reports, apply app blocking rules, enforce screen time limits, and provide child safety alerts.\n\n' +
        'Data is shared with the linked parent/guardian account and K.T.O servers. K.T.O Kids does not collect passwords or payment information, and does not use this data for advertising.',
    },
    {
      heading: 'Other actions',
      body:
        'Data type: Other actions.\n' +
        'Collected using AccessibilityService API: Yes.\n' +
        'What: Device actions performed by the app through AccessibilityService API — opening a blocking screen when a parent-blocked app is launched, or when a parent-set daily screen time / app limit is exceeded.\n' +
        'Purpose: Parental app blocking and screen time enforcement for child safety.',
    },
    {
      heading: 'Web browsing history',
      body:
        'Data type: Web browsing history.\n' +
        'Collected using AccessibilityService API: Yes.\n' +
        'What: Website / URL text visible on the current browser screen (for example domain text in the address bar or on the page), read through AccessibilityService API window and text events.\n' +
        'Purpose: Website activity reports and child safety alerts for the linked parent account.\n' +
        'Note: Saved browser history databases are not read.',
    },
    {
      heading: 'Emails',
      body:
        'Data type: Emails.\n' +
        'Collected using AccessibilityService API: Yes.\n' +
        'What: Email content that is visible on the device screen, processed through AccessibilityService API on-screen text events.\n' +
        'Purpose: Detect unsafe content and send child safety alerts to the linked parent.\n' +
        'Note: Email inboxes and mail account databases are not accessed.',
    },
    {
      heading: 'Precise location',
      body:
        'Data type: Precise location.\n' +
        'Collected using AccessibilityService API: No.\n' +
        'What: Precise location is not collected through the AccessibilityService API.\n' +
        'How location is collected (separate permission): Only when the Android Location permission is granted.\n' +
        'Purpose of location (when enabled): Parental live location tracking for child safety, independent of AccessibilityService API.',
    },
    {
      heading: 'Crash logs',
      body:
        'Data type: Crash logs.\n' +
        'Collected using AccessibilityService API: No.\n' +
        'What: Crash logs are not collected or uploaded through the AccessibilityService API.\n' +
        'Purpose of this disclosure: To state clearly that Crash logs are not part of AccessibilityService API data collection. Local debug logs stay on the device and are not sent to the parent account.',
    },
    {
      heading: 'SMS or MMS messages',
      body:
        'Data type: SMS or MMS messages.\n' +
        'Collected using AccessibilityService API: Yes.\n' +
        'What: SMS or MMS message text visible on the device screen when a messaging app is open, processed through AccessibilityService API on-screen text events.\n' +
        'Purpose: Detect unsafe content and send child safety alerts to the linked parent.\n' +
        'Note: SMS/MMS databases and message stores are not accessed.',
    },
    {
      heading: 'Name',
      body:
        'Data type: Name.\n' +
        'Collected using AccessibilityService API: Yes (only if visible on screen).\n' +
        'What: A person\'s name when it appears as visible on-screen text and is included in a safety-alert text snippet (up to 200 characters).\n' +
        'Purpose: Incidental inclusion in child safety alerts sent to the linked parent.\n' +
        'Note: Contact lists and account profiles are not accessed.',
    },
    {
      heading: 'Email address',
      body:
        'Data type: Email address.\n' +
        'Collected using AccessibilityService API: Yes (only if visible on screen).\n' +
        'What: An email address when it appears as visible on-screen text in a safety-alert snippet.\n' +
        'Purpose: Incidental inclusion in child safety alerts sent to the linked parent.\n' +
        'Note: Email account databases are not accessed.',
    },
    {
      heading: 'Personal identifiers',
      body:
        'Data type: Personal identifiers.\n' +
        'Collected using AccessibilityService API: Yes (only if visible on screen).\n' +
        'What: Identifiers such as usernames or account IDs when visible on screen and included in a safety-alert snippet.\n' +
        'Purpose: Incidental inclusion in child safety alerts sent to the linked parent.\n' +
        'Note: Device account databases are not accessed.',
    },
    {
      heading: 'Address',
      body:
        'Data type: Address.\n' +
        'Collected using AccessibilityService API: Yes (only if visible on screen).\n' +
        'What: A postal or physical address when it appears as visible on-screen text in a safety-alert snippet.\n' +
        'Purpose: Incidental inclusion in child safety alerts sent to the linked parent.\n' +
        'Note: Stored address profiles are not accessed.',
    },
    {
      heading: 'Phone number',
      body:
        'Data type: Phone number.\n' +
        'Collected using AccessibilityService API: Yes (only if visible on screen).\n' +
        'What: A phone number when it appears as visible on-screen text in a safety-alert snippet.\n' +
        'Purpose: Incidental inclusion in child safety alerts sent to the linked parent.\n' +
        'Note: Call logs and contact databases are not accessed.',
    },
    {
      heading: 'Other user-generated content',
      body:
        'Data type: Other user-generated content.\n' +
        'Collected using AccessibilityService API: Yes.\n' +
        'What: Text the user types or sees on screen (messages, posts, searches, chat text, captions), processed through AccessibilityService API text-change and window content events. Up to 200 characters may be sent when unsafe / restricted content is detected.\n' +
        'Purpose: Child safety alerts and restricted activity reporting to the linked parent.',
    },
    {
      heading: 'Your consent',
      body:
        'You must read every data type above, check the consent box, and tap Continue before Android Accessibility settings open. AccessibilityService API data collection begins only after you enable the K.T.O Kids Accessibility Service in settings. You may decline and exit without enabling Accessibility.',
    },
  ],
  checkboxLabel:
    'I have read this AccessibilityService API disclosure. I understand the app\'s use of: Other actions, Web browsing history, Emails, Precise location, Crash logs, SMS or MMS messages, Name, Email address, Personal identifiers, Address, Phone number, and Other user-generated content. I consent to parental control and child safety use as described.',
};
