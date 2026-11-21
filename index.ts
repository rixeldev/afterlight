// Must be the first import: shims needed by CommonJS builds resolved on native
// (notably Three.js's process.emitWarning call) before the app graph loads.
import './src/polyfills';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
