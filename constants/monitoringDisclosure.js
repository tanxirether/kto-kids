export const DISCLOSURE_STORAGE_KEY = 'monitoring_prominent_disclosure_v2';
export const ACCESSIBILITY_DISCLOSURE_KEY = 'accessibility_prominent_disclosure_v2';

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
        '• Device location (when location permission is enabled)\n' +
        '• Photos from the device camera (when enabled by the parent)\n' +
        '• Microphone audio (when enabled by the parent)\n' +
        '• Screen content during parent-initiated screen sharing (after on-device consent)\n' +
        '• Keyword safety alerts when configured text appears on screen\n' +
        '• Device and app status needed to keep monitoring active',
    },
    {
      heading: 'Android Accessibility Service',
      body:
        'If you enable Accessibility for K.T.O Kids, the app uses the Android Accessibility API to:\n' +
        '• Detect which application is in the foreground\n' +
        '• Record how long apps are used\n' +
        '• Read on-screen text to match parent-configured keyword alerts\n\n' +
        'Accessibility data is used only for parental monitoring and child safety. It is shared with the linked parent account. K.T.O Kids does not use Accessibility to perform unauthorized taps, purchases, or password collection.',
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

export const ACCESSIBILITY_DISCLOSURE = {
  title: 'Accessibility Service — required disclosure',
  bannerText:
    'Before enabling Accessibility, you must consent to how K.T.O Kids uses the Accessibility API on this device.',
  sections: [
    {
      heading: 'Why we request Accessibility',
      body:
        'K.T.O Kids uses the Android Accessibility Service on this child device so a linked parent can receive app-usage reports and keyword safety alerts through the K.T.O Parent App.',
    },
    {
      heading: 'Data accessed through Accessibility API',
      body:
        'When Accessibility is enabled, K.T.O Kids may access and process:\n' +
        '• Foreground application package name (which app is open)\n' +
        '• App open, close, and usage duration events\n' +
        '• On-screen text and text-change events to detect parent-configured keywords\n' +
        '• Window and view events needed for usage monitoring\n\n' +
        'This data is collected on the child device, transmitted to K.T.O servers, and displayed to the linked parent/guardian account.',
    },
    {
      heading: 'How the data is used',
      body:
        'Accessibility data is used solely for parental monitoring and child safety features: app usage reporting, activity timelines, and keyword alerts. It is not used for advertising or sold to data brokers.',
    },
    {
      heading: 'What we do not do',
      body:
        'K.T.O Kids does not use Accessibility to perform taps, purchases, account changes, or other actions without the user\'s knowledge.',
    },
    {
      heading: 'Next step',
      body:
        'After you agree below, Android system settings will open so you can enable the K.T.O Kids Accessibility Service. Monitoring through Accessibility begins only after you turn it on in settings.',
    },
  ],
  checkboxLabel:
    'I consent to K.T.O Kids collecting and sharing Accessibility API data (app usage, foreground app names, and on-screen text for keyword alerts) with the linked parent account as described above.',
};
