import { expect, Page, test } from '@playwright/test';
import { resolve } from 'node:path';

const openTestDashboard = async (page: Page) => {
    await page.route('**/modern-room-card.js*', (route) => route.fulfill({ path: resolve('dist/modern-room-card.js'), contentType: 'text/javascript' }));
    await page.goto('/lovelace/test-matrix');
    await page.locator('modern-room-card, onboarding-welcome, ha-auth-flow').first().waitFor();

    if ((await page.locator('onboarding-welcome, ha-auth-flow').count()) > 0) {
        throw new Error('Log in to a Home Assistant test instance and provide HA_STORAGE_STATE.');
    }
};

test('loads the development dashboard and renders the maintained card matrix', async ({ page }) => {
    await openTestDashboard(page);

    await expect(page.locator('modern-room-card')).toHaveCount(4);
    await expect(page.locator('modern-room-card').first()).toContainText('Living room');
    await expect(page.locator('modern-room-card').first()).toContainText('21.5');
    const compactFixture = page.locator('modern-room-card').filter({ hasText: 'Right-aligned compact room' });
    await expect(compactFixture.locator('ha-card')).toHaveClass(/compact/);
});

test('keeps the card usable at a narrow viewport', async ({ page }) => {
    await openTestDashboard(page);

    const card = page.locator('modern-room-card').first();
    await expect(card).toBeVisible();
    await expect(card).toContainText('Living room');
});

test('registers and renders the visual editor in Home Assistant', async ({ page }) => {
    await openTestDashboard(page);

    await page.locator('modern-room-card').first().evaluate((host) => {
        const card = host as HTMLElement & { hass?: unknown };
        const editor = document.createElement('modern-room-card-editor') as HTMLElement & {
            hass?: unknown;
            setConfig: (config: Record<string, unknown>) => void;
        };
        editor.hass = card.hass;
        editor.setConfig({
            type: 'custom:modern-room-card',
            title: 'Editor test',
            entity: 'input_boolean.room_occupied',
            appearance: {
                transition: 'subtle',
                states: [
                    {
                        entity: 'input_boolean.room_occupied',
                        condition: 'equals',
                        value: 'on',
                        background: 'entity-color',
                        opacity: 0.15,
                        priority: 10,
                    },
                ],
            },
            info_entities: ['sensor.test_room_temperature'],
            rows: [{ entities: ['input_boolean.ceiling_light'] }],
        });
        document.body.append(editor);
    });

    const editor = page.locator('modern-room-card-editor');
    await expect(editor.locator('ha-entity-picker.main-picker')).toHaveJSProperty('value', 'input_boolean.room_occupied');
    await expect(editor).toContainText('Info entities');
    await expect(editor).toContainText('Rows');
    await expect(editor).toContainText('Appearance');
    await expect(editor.locator('.appearance-rule')).toHaveCount(1);
});

test('keeps expanded visual-editor controls contained at representative widths', async ({ page }) => {
    await openTestDashboard(page);

    await page.locator('modern-room-card').first().evaluate((host) => {
        const card = host as HTMLElement & { hass?: unknown };
        const editor = document.createElement('modern-room-card-editor') as HTMLElement & {
            hass?: unknown;
            setConfig: (config: Record<string, unknown>) => void;
        };
        editor.className = 'responsive-test-editor';
        editor.style.cssText = 'display:block; box-sizing:border-box; margin:8px; width:calc(100vw - 16px)';
        editor.hass = card.hass;
        editor.setConfig({
            type: 'custom:modern-room-card',
            title: 'Responsive editor test',
            entity: 'input_boolean.room_occupied',
            layout: 'compact',
            content_size: 'large',
            title_wrap: 'ellipsis',
            tap_action: { action: 'toggle' },
            hold_action: { action: 'more-info' },
            double_tap_action: { action: 'toggle' },
            info_entities: [{ entity: 'sensor.test_room_temperature', show_state: true }],
            rows: [{ content_alignment: 'right', entities: ['input_boolean.ceiling_light'] }],
            appearance: {
                transition: 'subtle',
                states: [
                    {
                        entity: 'input_boolean.room_occupied',
                        attribute: 'friendly_name',
                        condition: 'not_equals',
                        value: 'missing',
                        background: 'linear-gradient(red, blue)',
                        accent: 'entity-color',
                        foreground: 'var(--primary-text-color)',
                        opacity: 0.15,
                        priority: 10,
                    },
                ],
            },
        });
        document.body.append(editor);
    });

    const editor = page.locator('.responsive-test-editor');
    await expect(editor.locator('.layout-select')).toHaveJSProperty('value', 'compact');
    await expect(editor.locator('.content-size-select')).toHaveJSProperty('value', 'large');
    await expect(editor.locator('.title-wrap-select')).toHaveJSProperty('value', 'ellipsis');
    await expect(editor.locator('.appearance-transition')).toHaveJSProperty('value', 'subtle');

    await editor.locator('ha-expansion-panel').evaluateAll((panels) => {
        panels.forEach((panel) => {
            (panel as HTMLElement & { expanded?: boolean }).expanded = true;
            (panel as HTMLElement & { requestUpdate?: () => void }).requestUpdate?.();
        });
    });

    for (const width of [360, 390, 600, 1000]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(50);
        const result = await editor.evaluate((host) => {
            const root = host.shadowRoot!;
            const container = root.querySelector('.card-config') as HTMLElement;
            const boundary = container.getBoundingClientRect();
            const selectors = 'ha-select, ha-input, ha-entity-picker, ha-icon-picker, ha-slider, ha-expansion-panel, ha-button, ha-icon-button, ha-code-editor';
            const outside = [...root.querySelectorAll<HTMLElement>(selectors)]
                .filter((control) => {
                    const rect = control.getBoundingClientRect();
                    return rect.width > 0 && (rect.left < boundary.left - 1 || rect.right > boundary.right + 1);
                })
                .map((control) => control.localName);
            return {
                clientWidth: container.clientWidth,
                scrollWidth: container.scrollWidth,
                outside,
            };
        });
        expect(result.scrollWidth, `${width}px editor scroll width`).toBeLessThanOrEqual(result.clientWidth);
        expect(result.outside, `${width}px controls outside editor`).toEqual([]);
    }
});

test('mirrors inline row alignment in RTL without changing card containment', async ({ page }) => {
    await openTestDashboard(page);
    const card = page.locator('modern-room-card').filter({ hasText: 'Row alignment matrix' });

    const positions = async () =>
        card.evaluate((host) => {
            const root = host.shadowRoot!;
            const cardRect = root.querySelector('ha-card')!.getBoundingClientRect();
            const leftRect = root.querySelector('.content-left .entity')!.getBoundingClientRect();
            const rightRect = root.querySelector('.content-right .entity')!.getBoundingClientRect();
            return {
                leftStart: leftRect.left - cardRect.left,
                leftEnd: cardRect.right - leftRect.right,
                rightStart: rightRect.left - cardRect.left,
                rightEnd: cardRect.right - rightRect.right,
                contained: root.querySelector('ha-card')!.scrollWidth <= root.querySelector('ha-card')!.clientWidth,
            };
        });

    const ltr = await positions();
    expect(ltr.leftStart).toBeLessThan(ltr.leftEnd);
    expect(ltr.rightEnd).toBeLessThan(ltr.rightStart);
    expect(ltr.contained).toBe(true);

    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    const rtl = await positions();
    expect(rtl.leftEnd).toBeLessThan(rtl.leftStart);
    expect(rtl.rightStart).toBeLessThan(rtl.rightEnd);
    expect(rtl.contained).toBe(true);
    await page.evaluate(() => document.documentElement.removeAttribute('dir'));
});

test('contains long content across representative card theme variants', async ({ page }) => {
    await openTestDashboard(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const variants = [
        {
            name: 'light',
            variables: {
                '--primary-text-color': '#202124',
                '--ha-card-background': '#ffffff',
                '--ha-card-border-radius': '12px',
                'font-size': '16px',
            },
        },
        {
            name: 'dark-transparent-large-type',
            variables: {
                '--primary-text-color': '#f1f1f1',
                '--ha-card-background': 'rgba(30, 30, 30, 0.72)',
                '--ha-card-border-radius': '24px',
                'font-size': '20px',
            },
        },
    ];

    for (const variant of variants) {
        await page.evaluate((variables) => {
            for (const [property, value] of Object.entries(variables)) {
                document.documentElement.style.setProperty(property, value);
            }
        }, variant.variables);
        const results = await page.locator('modern-room-card').evaluateAll((cards) =>
            cards.map((host) => {
                const card = host.shadowRoot!.querySelector('ha-card') as HTMLElement;
                return {
                    contained: card.scrollWidth <= card.clientWidth,
                    radius: getComputedStyle(card).borderRadius,
                    background: getComputedStyle(card).backgroundColor,
                };
            }),
        );
        expect(results.every((result) => result.contained), `${variant.name} containment`).toBe(true);
        expect(results.every((result) => result.radius.length > 0), `${variant.name} radius`).toBe(true);
        expect(results.every((result) => result.background.length > 0), `${variant.name} background`).toBe(true);
    }
});
