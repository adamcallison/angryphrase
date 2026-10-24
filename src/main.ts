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

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- strict-null on DOM API return (#app guaranteed by index.html); not noUncheckedIndexedAccess.
const app = mount(App, { target: document.getElementById('app')!, props: { appStore: store } });

export default app;
