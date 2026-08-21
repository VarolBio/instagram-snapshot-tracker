/**
 * A mount check for the shell: the app renders, the privacy promise is on screen, and
 * every tab can be opened without throwing. IndexedDB does not exist in this
 * environment, which also exercises the graceful no-persistence path.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function mount() {
  await act(async () => {
    root.render(<App />);
  });
}

async function clickTab(label: string) {
  const button = [...container.querySelectorAll('nav button')].find(
    (el) => el.textContent?.trim().startsWith(label),
  );
  if (!button) throw new Error(`No tab labelled ${label}`);
  await act(async () => {
    (button as HTMLButtonElement).click();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe('the app shell', () => {
  it('states the privacy promise before anything else', async () => {
    await mount();
    expect(container.textContent).toContain(
      'processed locally in your browser and is not uploaded to a server',
    );
  });

  it('lands on the upload screen with instructions', async () => {
    await mount();
    expect(container.textContent).toContain('Drop your Instagram export here');
    expect(container.textContent).toContain('How to get your export');
  });

  it('opens every tab without crashing', async () => {
    await mount();
    for (const label of [
      'Current',
      "Doesn't follow back",
      'Changes',
      'Accounts',
      'Snapshots',
      'Settings',
      'Upload',
    ]) {
      await clickTab(label);
      expect(container.textContent, `${label} tab rendered nothing`).toBeTruthy();
    }
  });

  it('invites an upload rather than showing empty tables', async () => {
    await mount();
    await clickTab('Current');
    expect(container.textContent).toContain('Nothing to show yet');
    await clickTab('Changes');
    expect(container.textContent).toContain('Two snapshots are needed to compare');
  });

  it('spells out the limitations on the settings screen', async () => {
    await mount();
    await clickTab('Settings');
    expect(container.textContent).toContain('What this app cannot tell you');
    expect(container.textContent).toContain('"All time" is not all of history');
    expect(container.textContent).toContain('Organisation keyword guesses');
  });
});
