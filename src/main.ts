import './styles/index.css';
import App from './App.svelte';
import { mount } from 'svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Could not find #app element to mount the application');
}
const app = mount(App, {target});

export default app;
