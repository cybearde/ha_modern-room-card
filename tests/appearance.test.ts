import { describe, expect, it } from 'vitest';
import {
    appearanceRuleMatches,
    kelvinToRgb,
    resolveAppearance,
    resolveEntityColor,
    selectAppearanceRule,
    validateAppearanceConfig,
} from '../src/appearance';
import ModernRoomCard from '../src/index';
import { RoomCardAppearanceRule } from '../src/types';
import { getEntityIds } from '../src/util';

const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) => ({
    entity_id,
    state: value,
    attributes,
    context: { id: 'context', parent_id: null, user_id: null },
    last_changed: '2026-01-01T00:00:00.000Z',
    last_updated: '2026-01-01T00:00:00.000Z',
});

const hass = (states: Record<string, ReturnType<typeof state>>) =>
    ({
        states,
        locale: { language: 'en' },
        localize: (key: string) => key,
    }) as any;

describe('conditional appearance rules', () => {
    it('defines subtle transitions and disables them for reduced motion', () => {
        expect(ModernRoomCard.styles.cssText).toContain('color 200ms ease');
        expect(ModernRoomCard.styles.cssText).toContain('border-color 200ms ease');
        expect(ModernRoomCard.styles.cssText).toContain('box-shadow 200ms ease');
        expect(ModernRoomCard.styles.cssText).toContain('prefers-reduced-motion: reduce');
        expect(ModernRoomCard.styles.cssText).toContain('--modern-room-card-conditional-background-opacity');
    });

    it('keeps the neutral appearance when configuration is absent or no rule matches', () => {
        const instance = hass({ 'light.room': state('light.room', 'off') });
        expect(resolveAppearance(undefined, instance)).toEqual({ styles: {} });
        expect(
            resolveAppearance(
                { states: [{ entity: 'light.room', condition: 'equals', value: 'on', background: 'red' }] },
                instance,
            ),
        ).toEqual({ styles: {} });
    });

    it.each([
        ['equals', '21', true],
        ['not_equals', '20', true],
        ['above', 20, true],
        ['below', 22, true],
    ] as const)('supports the %s operator', (condition, value, expected) => {
        const rule: RoomCardAppearanceRule = { entity: 'sensor.temperature', condition, value };
        expect(appearanceRuleMatches(rule, hass({ 'sensor.temperature': state('sensor.temperature', '21') }))).toBe(
            expected,
        );
    });

    it('matches entity attributes', () => {
        const rule: RoomCardAppearanceRule = {
            entity: 'climate.room',
            attribute: 'current_temperature',
            condition: 'above',
            value: 24,
        };
        expect(
            appearanceRuleMatches(
                rule,
                hass({ 'climate.room': state('climate.room', 'heat', { current_temperature: 25.5 }) }),
            ),
        ).toBe(true);
    });

    it('selects the highest priority and keeps the first rule when priorities tie', () => {
        const instance = hass({ 'binary_sensor.alert': state('binary_sensor.alert', 'on') });
        const first = {
            entity: 'binary_sensor.alert',
            condition: 'equals' as const,
            value: 'on',
            priority: 100,
            background: 'red',
        };
        const tied = { ...first, background: 'orange' };
        const lower = { ...first, priority: 10, background: 'blue' };
        expect(selectAppearanceRule({ states: [lower, first, tied] }, instance)).toBe(first);
    });

    it('ignores missing, unknown, unavailable, and incomplete rule sources', () => {
        const instance = hass({
            'sensor.unknown': state('sensor.unknown', 'unknown'),
            'sensor.unavailable': state('sensor.unavailable', 'unavailable'),
        });
        expect(appearanceRuleMatches({ condition: 'equals', value: 'on' }, instance)).toBe(false);
        expect(appearanceRuleMatches({ entity: 'sensor.missing', condition: 'equals', value: 'on' }, instance)).toBe(
            false,
        );
        expect(
            appearanceRuleMatches({ entity: 'sensor.unknown', condition: 'equals', value: 'unknown' }, instance),
        ).toBe(false);
        expect(
            appearanceRuleMatches({ entity: 'sensor.unavailable', condition: 'equals', value: 'unavailable' }, instance),
        ).toBe(false);
    });

    it('validates opacity, priority, transition, and operators', () => {
        expect(() => validateAppearanceConfig({ states: [{ opacity: 1.1 }] })).toThrow('opacity must be between 0 and 1');
        expect(() => validateAppearanceConfig({ states: [{ priority: 'high' as any }] })).toThrow(
            'priority must be numeric',
        );
        expect(() => validateAppearanceConfig({ transition: 'pulse' as any })).toThrow('transition');
        expect(() => validateAppearanceConfig({ states: [{ condition: 'contains' as any }] })).toThrow('condition');
    });

    it('preserves plain CSS colors, gradients, and theme variables', () => {
        const instance = hass({ 'light.room': state('light.room', 'on') });
        const resolved = resolveAppearance(
            {
                states: [
                    {
                        entity: 'light.room',
                        condition: 'equals',
                        value: 'on',
                        background: 'linear-gradient(red, blue)',
                        foreground: 'var(--text-primary-color)',
                        accent: '#ff9800',
                        opacity: 0.4,
                    },
                ],
            },
            instance,
        );
        expect(resolved.styles).toMatchObject({
            '--modern-room-card-conditional-background': 'linear-gradient(red, blue)',
            '--modern-room-card-conditional-background-opacity': '0.4',
            '--modern-room-card-conditional-foreground': 'var(--text-primary-color)',
            '--modern-room-card-accent': '#ff9800',
            '--primary-text-color': 'var(--modern-room-card-conditional-foreground)',
            '--secondary-text-color': 'var(--modern-room-card-conditional-foreground)',
            '--ha-color-text-primary': 'var(--modern-room-card-conditional-foreground)',
            '--ha-color-text-secondary': 'var(--modern-room-card-conditional-foreground)',
        });
        expect(resolved.styles).not.toHaveProperty('--state-icon-active-color');
    });

    it('resolves light RGB and color temperature values with a theme-safe fallback', () => {
        expect(resolveEntityColor('light.rgb', hass({ 'light.rgb': state('light.rgb', 'on', { rgb_color: [12, 34, 56] }) }))).toBe(
            'rgb(12, 34, 56)',
        );
        expect(
            resolveEntityColor(
                'light.warm',
                hass({ 'light.warm': state('light.warm', 'on', { color_temp_kelvin: 2700 }) }),
            ),
        ).toBe(kelvinToRgb(2700));
        expect(resolveEntityColor('light.missing', hass({}))).toBe('var(--primary-color)');
        expect(resolveEntityColor('switch.fan', hass({ 'switch.fan': state('switch.fan', 'on') }))).toContain(
            '--state-switch-on-color',
        );
    });

    it('uses a safe default opacity for entity-color backgrounds', () => {
        const resolved = resolveAppearance(
            {
                states: [
                    {
                        entity: 'light.room',
                        condition: 'equals',
                        value: 'on',
                        background: 'entity-color',
                    },
                ],
            },
            hass({ 'light.room': state('light.room', 'on', { rgb_color: [255, 0, 0] }) }),
        );
        expect(resolved.styles['--modern-room-card-conditional-background']).toBe('rgb(255, 0, 0)');
        expect(resolved.styles['--modern-room-card-conditional-background-opacity']).toBe('0.12');
    });

    it('gives explicit card styles precedence over conditional background and foreground', () => {
        const resolved = resolveAppearance(
            {
                states: [
                    {
                        entity: 'light.room',
                        condition: 'equals',
                        value: 'on',
                        background: 'red',
                        foreground: 'white',
                        accent: 'orange',
                    },
                ],
            },
            hass({ 'light.room': state('light.room', 'on') }),
            { background: 'black', color: 'yellow' },
        );
        expect(resolved.styles).not.toHaveProperty('--modern-room-card-conditional-background');
        expect(resolved.styles).not.toHaveProperty('--modern-room-card-conditional-foreground');
        expect(resolved.styles['--modern-room-card-accent']).toBe('orange');
    });

    it('merges explicit card styles after resolved appearance variables', async () => {
        const card = new ModernRoomCard();
        await card.setConfig({
            type: 'custom:modern-room-card',
            title: 'Room',
            rows: [],
            card_styles: {
                background: 'black',
                color: 'yellow',
                '--modern-room-card-accent': 'pink',
            },
            appearance: {
                states: [
                    {
                        entity: 'light.room',
                        condition: 'equals',
                        value: 'on',
                        background: 'red',
                        foreground: 'white',
                        accent: 'orange',
                    },
                ],
            },
        } as any);
        document.body.append(card);
        card.hass = hass({ 'light.room': state('light.room', 'on') });
        await card.updateComplete;

        const haCard = card.shadowRoot!.querySelector('ha-card') as HTMLElement;
        expect(haCard.style.background).toBe('black');
        expect(haCard.style.color).toBe('yellow');
        expect(haCard.style.getPropertyValue('--modern-room-card-accent')).toBe('pink');
        expect(haCard.style.getPropertyValue('--modern-room-card-conditional-background')).toBe('');
        expect(haCard.style.getPropertyValue('--modern-room-card-conditional-foreground')).toBe('');
    });

    it('scopes conditional foreground variables without replacing entity or state-icon colors', async () => {
        const card = new ModernRoomCard();
        await card.setConfig({
            type: 'custom:modern-room-card',
            title: 'Room',
            rows: [
                {
                    entities: [
                        {
                            entity: 'light.room',
                            show_icon: true,
                            state_color: true,
                            styles: { color: 'rgb(1, 2, 3)' },
                        },
                    ],
                },
            ],
            appearance: {
                states: [
                    {
                        entity: 'light.room',
                        condition: 'equals',
                        value: 'on',
                        foreground: 'white',
                    },
                ],
            },
        } as any);
        document.body.append(card);
        card.hass = hass({ 'light.room': state('light.room', 'on') });
        await card.updateComplete;

        const haCard = card.shadowRoot!.querySelector('ha-card') as HTMLElement;
        const entity = card.shadowRoot!.querySelector('.entities-row .entity') as HTMLElement;
        const badge = card.shadowRoot!.querySelector('state-badge') as any;
        expect(haCard.style.getPropertyValue('--primary-text-color')).toBe(
            'var(--modern-room-card-conditional-foreground)',
        );
        expect(haCard.style.getPropertyValue('--state-icon-active-color')).toBe('');
        expect(entity.style.color).toBe('rgb(1, 2, 3)');
        expect(badge.stateColor).toBe(true);
    });

    it('preserves template-based card styles and gives them precedence', async () => {
        const card = new ModernRoomCard();
        await card.setConfig({
            type: 'custom:modern-room-card',
            entity: 'light.room',
            rows: [],
            card_styles: {
                template: "return 'background: linear-gradient(red, blue); color: white;'",
            },
            appearance: {
                states: [
                    {
                        entity: 'light.room',
                        condition: 'equals',
                        value: 'on',
                        background: 'orange',
                        foreground: 'black',
                    },
                ],
            },
        } as any);
        document.body.append(card);
        card.hass = hass({ 'light.room': state('light.room', 'on') });
        await card.updateComplete;

        const haCard = card.shadowRoot!.querySelector('ha-card') as HTMLElement;
        expect(haCard.style.backgroundImage).toBe('linear-gradient(red, blue)');
        expect(haCard.style.color).toBe('white');
        expect(haCard.style.getPropertyValue('--modern-room-card-conditional-background')).toBe('');
        expect(haCard.style.getPropertyValue('--modern-room-card-conditional-foreground')).toBe('');
    });

    it('monitors rule entities and reacts when their state changes', async () => {
        const config = {
            type: 'custom:modern-room-card',
            title: 'Room',
            rows: [],
            appearance: {
                states: [
                    {
                        entity: 'light.room',
                        condition: 'equals' as const,
                        value: 'on',
                        background: 'red',
                    },
                ],
            },
        } as any;
        expect(getEntityIds(config)).toContain('light.room');

        const card = new ModernRoomCard();
        await card.setConfig(config);
        document.body.append(card);
        card.hass = hass({ 'light.room': state('light.room', 'off') });
        await card.updateComplete;
        expect(card.shadowRoot!.querySelector('ha-card')!.classList.contains('appearance-active')).toBe(false);

        const changed = state('light.room', 'on');
        changed.last_updated = '2026-01-01T00:01:00.000Z';
        card.hass = hass({ 'light.room': changed });
        await card.updateComplete;
        const haCard = card.shadowRoot!.querySelector('ha-card') as HTMLElement;
        expect(haCard.classList.contains('appearance-active')).toBe(true);
        expect(haCard.style.getPropertyValue('--modern-room-card-conditional-background')).toBe('red');
    });
});
