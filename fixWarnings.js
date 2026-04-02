/**
 * Must be imported first in index.js so LogBox ignores run before Firebase/native modules load.
 */
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  'NativeEventEmitter',
  'addListener',
  'removeListeners',
  'was called with a non-null argument without the required',
  'required `addListener` method',
  'required `removeListeners` method',
  'SafeAreaView has been deprecated',
  'getApp',
  'onMessage',
  'This method is deprecated',
  'no background event handler',
  'camera-is-restricted',
  'Camera functionality is not available because it has been restricted',
]);

const origWarn = console.warn;
console.warn = function (...args) {
  const str = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ');
  if (str.includes('NativeEventEmitter')) return;
  if (str.includes('camera-is-restricted') || str.includes('restricted by the operating system')) return;
  origWarn.apply(console, args);
};
