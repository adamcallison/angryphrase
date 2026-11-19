import './app.css';
import faviconUrl from './assets/favicon.png';

const link = document.createElement('link');
link.rel = 'icon';
link.type = 'image/png';
link.href = faviconUrl;
document.head.appendChild(link);

import { mount } from 'svelte';
import App from './ui/app/App.svelte';
import { createAppStore } from './ui/bindings/appStore.svelte';
import { createInitialAppState } from './ui/bindings/boot';
import { installTeardown } from './ui/bindings/teardown';
import { localStoragePort } from './ports/localStoragePort';
import { downloadPort } from './ports/downloadPort';
import { filePickPort } from './ports/filePickPort';
import { rngPort } from './ports/rngPort';
import { EpochMs } from './domain/time/EpochMs';

const ports = { storage: localStoragePort, download: downloadPort, filePick: filePickPort };
const deps = { rng: rngPort, now: () => EpochMs.of(Date.now()) };

const initial = createInitialAppState(ports, deps);
const store = createAppStore(initial, deps, ports);

installTeardown(store);

const target = document.getElementById('app');
if (target === null) throw new Error('main: #app element missing from index.html');
const app = mount(App, { target, props: { appStore: store } });

export default app;
