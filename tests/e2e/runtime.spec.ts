import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test.beforeEach(async ({ page }) => {
    await page.setContent('<body style="color:rgb(20,20,20); --primary-text-color:rgb(240,240,240)"></body>');
    await page.addScriptTag({ path: resolve('dist/modern-room-card.js') });
    await page.evaluate(async () => {
        const card = document.createElement('modern-room-card') as any;
        card.setConfig({ type: 'custom:modern-room-card', title: 'Room', entity: 'light.test',
            tap_action: { action: 'toggle' },
            info_entities: [{ entity: 'light.test', tap_action: { action: 'more-info' } }],
            appearance: { states: [{ entity: 'light.test', condition: 'equals', value: 'on', foreground: 'var(--primary-text-color)' }] },
        });
        card.hass = { states: { 'light.test': { entity_id: 'light.test', state: 'on', attributes: {}, last_changed: '2026-01-01', last_updated: '2026-01-01' } },
            locale: { language: 'en' }, localize: () => '' };
        document.body.append(card);
        (window as any).actions = [];
        document.body.addEventListener('hass-action', (ev) => (window as any).actions.push((ev as CustomEvent).detail));
        await card.updateComplete;
    });
});

test('resolves foreground theme variables without cycles and follows theme changes', async ({ page }) => {
    const card = page.locator('modern-room-card ha-card');
    await expect(card).toHaveCSS('color', 'rgb(240, 240, 240)');
    await page.evaluate(() => document.body.style.setProperty('--primary-text-color', 'rgb(30, 40, 50)'));
    await expect(card).toHaveCSS('color', 'rgb(30, 40, 50)');
    await expect(page.locator('.title')).toHaveCSS('color', 'rgb(30, 40, 50)');
});

test('isolates real pointer and keyboard input on info entities', async ({ page, isMobile }) => {
    const info = page.locator('.entities-info-row .entity');
    if (isMobile) await info.tap(); else await info.click();
    await info.press('Enter'); await info.press('Space');
    const actions = await page.evaluate(() => (window as any).actions);
    expect(actions).toHaveLength(3);
    expect(actions.every((entry: any) => entry.config.tap_action.action === 'more-info')).toBe(true);
});

test('uses current double-tap options and retains delayed taps after moving away', async ({ page }) => {
    await page.locator('modern-room-card').evaluate(async (card: any) => {
        card.setConfig({ ...card.config, double_tap_action: { action: 'more-info' } });
        await card.updateComplete;
    });
    const title = page.locator('.title-text');
    await title.dblclick();
    await expect.poll(() => page.evaluate(() => (window as any).actions.map((entry: any) => entry.action))).toEqual(['double_tap']);
    await title.click(); await page.mouse.move(0, 600);
    await expect.poll(() => page.evaluate(() => (window as any).actions.map((entry: any) => entry.action))).toEqual(['double_tap', 'tap']);
});

test('keeps the configured tap after a slow press when hold is absent', async ({ page }) => {
    const title = page.locator('.title-text');
    const rect = await title.boundingBox();
    await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
    await page.mouse.down(); await page.waitForTimeout(550); await page.mouse.up();
    await expect.poll(() => page.evaluate(() => (window as any).actions.map((entry: any) => entry.action))).toEqual(['tap']);
});
