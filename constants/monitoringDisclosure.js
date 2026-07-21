export const DISCLOSURE_STORAGE_KEY = 'monitoring_prominent_disclosure_v3';
export const ACCESSIBILITY_DISCLOSURE_KEY = 'accessibility_prominent_disclosure_v10';
export const LOCATION_DISCLOSURE_KEY = 'location_prominent_disclosure_v1';
/** User toggled Live Location monitoring on/off in Permission screen (independent of OS grant). */
export const LIVE_LOCATION_FEATURE_KEY = 'live_location_feature_enabled_v1';

/** Exact labels from Google Play Accessibility rejection — must appear in UI text. */
export const GOOGLE_ACCESSIBILITY_DATA_TYPES = [
  'Diagnostics',
  'Other app performance data',
  'Device or other identifiers',
  'Approximate location',
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
      heading: 'Location data (precise location)',
      body:
        'When Live Location is enabled with consent, K.T.O Kids collects precise location data (GPS / network location), including while the app is in the background when background location permission is granted.\n\n' +
        'Purpose: parental monitoring and child safety — so the linked parent can see the child device\'s location in the K.T.O Parent App.\n\n' +
        'Who receives location data: the linked parent/guardian account and K.T.O servers. Location is not sold or used for advertising.\n\n' +
        'Before Live Location is turned on, K.T.O Kids shows a separate full-screen Location disclosure that you must accept.',
    },
    {
      heading: 'Data this app may collect (with consent)',
      body:
        '• Precise location / Live Location (foreground and background when enabled)\n' +
        '• Foreground app names and app usage duration\n' +
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
    'I confirm I am the device owner or have permission from a parent/guardian. I have read this disclosure and consent to parental monitoring and data collection as described, including Location data when Live Location is enabled.',
};

/**
 * Separate prominent disclosure shown before Live Location permission (Google Play User Data policy).
 */
export const LOCATION_DISCLOSURE = {
  title: 'Location data — required disclosure',
  bannerText:
    'K.T.O Kids collects Location data for parental monitoring. Read this disclosure before enabling Live Location.',
  sections: [
    {
      heading: 'What Location data is collected',
      body:
        'When you enable Live Location, K.T.O Kids accesses and collects precise location data from this device, including:\n\n' +
        '• GPS / network-based precise location (latitude and longitude)\n' +
        '• Location accuracy and timestamp\n' +
        '• Location while the app is in use and, when background location is granted, while the app is closed or not in use\n\n' +
        'This is Location data used for parental monitoring on a child device.',
    },
    {
      heading: 'How Location data is used (purpose)',
      body:
        'Location data is collected and used only to:\n\n' +
        '• Show the child device\'s live and recent location to the linked parent/guardian in the K.T.O Parent App\n' +
        '• Support family safety and parental monitoring features\n\n' +
        'Location data is not used for advertising, marketing, or sold to third parties.',
    },
    {
      heading: 'Who receives Location data',
      body:
        'Location data is transmitted to:\n\n' +
        '• The linked parent/guardian account via the K.T.O Parent App\n' +
        '• K.T.O servers that operate monitoring features\n\n' +
        'Only the linked parent/guardian can view this location for this paired child device.',
    },
    {
      heading: 'When collection happens',
      body:
        'Location collection begins only after you accept this disclosure and grant Android Location permission (including background location on Android 10+ when requested). You may decline and leave Live Location turned off.',
    },
  ],
  checkboxLabel:
    'I have read this Location disclosure. I consent to K.T.O Kids collecting and sharing precise Location data (including in the background when permitted) with the linked parent account for parental monitoring and child safety.',
};

/**
 * Prominent disclosure for AccessibilityService API (Google Play User Data policy).
 * Each Google-declared data type has its own heading with collection + purpose.
 */
export const ACCESSIBILITY_DISCLOSURE = {
  title: 'AccessibilityService API — data use disclosure',
  bannerText:
    'This AccessibilityService API prominent disclosure explains data collection and purpose.\n\n' +
    'REQUIRED — these data types are disclosed here:\n' +
    '• Diagnostics\n' +
    '• Other app performance data\n' +
    '• Device or other identifiers\n' +
    '• Approximate location',
  dataTypesLabel: 'All AccessibilityService API data types in this disclosure',
  dataTypes: GOOGLE_ACCESSIBILITY_DATA_TYPES,
  sections: [
    {
      heading: 'Diagnostics',
      body:
        'Diagnostics\n\n' +
        'K.T.O Kids collects Diagnostics using the AccessibilityService API.\n\n' +
        'What: AccessibilityService health and Diagnostics information — for example whether the AccessibilityService is running, service failure messages, and last Accessibility event status used to keep monitoring reliable.\n\n' +
        'Purpose: Diagnose AccessibilityService API problems and keep parental monitoring (app usage, blocking, safety alerts) working on the child device.\n\n' +
        'Shared with: Linked parent/guardian account and K.T.O servers as needed to operate monitoring. Not used for advertising.',
    },
    {
      heading: 'Other app performance data',
      body:
        'Other app performance data\n\n' +
        'K.T.O Kids collects Other app performance data using the AccessibilityService API.\n\n' +
        'What: Other app performance data including app open/close timing, how long apps stay in the foreground, and daily app usage duration from AccessibilityService API window state events.\n\n' +
        'Purpose: Activity reports, screen time limits, and parental monitoring of app usage on the child device for the linked parent account.',
    },
    {
      heading: 'Device or other identifiers',
      body:
        'Device or other identifiers\n\n' +
        'K.T.O Kids collects Device or other identifiers using the AccessibilityService API.\n\n' +
        'What: Device or other identifiers in the form of application package names (app identifiers) for apps that become foreground, from AccessibilityService API events.\n\n' +
        'Purpose: App usage reports, app blocking, and child safety monitoring for the linked parent account.\n\n' +
        'Note: These Device or other identifiers are app package names for parental control — not advertising IDs for ads.',
    },
    {
      heading: 'Approximate location',
      body:
        'Approximate location\n\n' +
        'K.T.O Kids discloses Approximate location in this AccessibilityService API prominent disclosure.\n\n' +
        'What: Approximate location (network / coarse location) of the child device when parental Live Location monitoring is enabled.\n\n' +
        'How Approximate location is collected: Approximate location is collected with the Android Location permission (ACCESS_COARSE_LOCATION / Live Location flow). Approximate location values are not read from Accessibility window text. This AccessibilityService API disclosure still lists Approximate location so Approximate location is apparent before Accessibility and parental monitoring features continue.\n\n' +
        'Purpose: Parental monitoring and child safety — share Approximate location / family location with the linked parent account.\n\n' +
        'If you enable Live Location, you will also see a separate Location disclosure before location permission is requested.',
    },
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
        'You must read every data type above — including Diagnostics, Other app performance data, Device or other identifiers, and Approximate location — check the consent box, and tap Continue before Android Accessibility settings open. AccessibilityService API data collection begins only after you enable the K.T.O Kids Accessibility Service in settings. You may decline and exit without enabling Accessibility.',
    },
  ],
  checkboxLabel:
    'I have read this AccessibilityService API disclosure (including Diagnostics, Other app performance data, Device or other identifiers, Approximate location, and the other listed data types). I consent to parental control and child safety use as described.',
};
