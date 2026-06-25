export const DISCLOSURE_STORAGE_KEY = 'monitoring_prominent_disclosure_v1';
export const ACCESSIBILITY_DISCLOSURE_KEY = 'accessibility_prominent_disclosure_v1';

export const MONITORING_DISCLOSURE = {
  title: 'Parental monitoring disclosure',
  sections: [
    {
      heading: 'What this app is',
      body:
        'K.T.O Kids is a parental monitoring app installed on a child\'s device. A parent or legal guardian links this device to their account to help supervise online activity and device use.',
    },
    {
      heading: 'Who receives the data',
      body:
        'Collected information is sent to the linked parent/guardian account and our servers only to provide parental monitoring features. It is not sold to third parties for advertising.',
    },
    {
      heading: 'Data we may collect',
      body:
        '• App usage and foreground app names\n' +
        '• Device location (when enabled)\n' +
        '• Photos from the device camera (when enabled by the parent)\n' +
        '• Microphone audio (when enabled by the parent)\n' +
        '• Screen content via screen sharing (when enabled and consented)\n' +
        '• Alerts when configured keywords appear on screen\n' +
        '• Device status needed to keep monitoring active in the background',
    },
    {
      heading: 'Accessibility Service',
      body:
        'If you enable the K.T.O Kids Accessibility Service, the app uses the Android Accessibility API to detect which app is in the foreground, measure app usage time, and check on-screen text for parent-configured keyword alerts. We do not use Accessibility to change user actions without consent or to collect passwords from other apps.',
    },
    {
      heading: 'Your consent',
      body:
        'By continuing, you confirm that you are the device owner or have permission from a parent/guardian, you have read this disclosure, and you consent to this data collection for parental monitoring.',
    },
  ],
  checkboxLabel:
    'I have read this disclosure and consent to parental monitoring on this device.',
};

export const ACCESSIBILITY_DISCLOSURE = {
  title: 'Accessibility Service disclosure',
  sections: [
    {
      heading: 'Why Accessibility is requested',
      body:
        'K.T.O Kids uses the Android Accessibility Service so a linked parent can receive app-usage reports and safety alerts on this child device.',
    },
    {
      heading: 'Data accessed through Accessibility',
      body:
        '• Foreground application package name\n' +
        '• App open/close and usage duration\n' +
        '• On-screen text events to match parent-configured keywords\n' +
        '• Basic view interaction events needed for monitoring\n\n' +
        'This data is used only for parental monitoring and safety features.',
    },
    {
      heading: 'What we do not do',
      body:
        'We do not use Accessibility to perform taps, purchases, or account changes on your behalf without your knowledge.',
    },
    {
      heading: 'Consent',
      body:
        'You must enable the K.T.O Kids Accessibility Service in system settings after accepting this disclosure.',
    },
  ],
  checkboxLabel:
    'I consent to Accessibility-based app usage and keyword monitoring as described above.',
};
