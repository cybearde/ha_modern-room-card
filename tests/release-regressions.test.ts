import { afterEach, describe, expect, it, vi } from 'vitest';
import ModernRoomCard from '../src/index';
import { ModernRoomCardEditor } from '../src/editor';

const entity = (state = 'on', attributes = {}) => ({
    entity_id: 'light.test', state, attributes, last_updated: '2026-09-06', last_changed: '2026-09-06',
});
const localize = (key: string) => key;
const locale = { language: 'en' };
const hass = (state = 'on', attributes = {}) => ({ states: { 'light.test': entity(state, attributes) }, locale, localize }) as any;
const mounted: HTMLElement[] = [];
const mount = async (config: any, instance = hass()) => {
    const card = new ModernRoomCard();
    card.setConfig({ type: 'custom:modern-room-card', rows: [], ...config });
    card.hass = instance;
    document.body.append(card);
    mounted.push(card);
    await card.updateComplete;
    return card;
};
const pointer = (element: Element, type: string) => element.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
const click = (element: Element) => {
    pointer(element, 'pointerdown'); pointer(element, 'pointerup'); pointer(element, 'click');
};
afterEach(() => {
    mounted.forEach((element) => element.remove()); mounted.length = 0;
    vi.useRealTimers(); vi.restoreAllMocks();
    delete (window as any).loadCardHelpers;
});

describe('release action regressions', () => {
    it.each(['click', 'Enter', ' '])('isolates info-entity %s from the header', async (gesture) => {
        const card = await mount({ entity: 'light.test', tap_action: { action: 'toggle' },
            info_entities: [{ entity: 'light.test', tap_action: { action: 'more-info' } }] });
        const actions: any[] = [];
        card.addEventListener('hass-action', (e) => actions.push((e as CustomEvent).detail));
        const info = card.shadowRoot!.querySelector('.entities-info-row .entity')!;
        if (gesture === 'click') click(info);
        else {
            info.dispatchEvent(new KeyboardEvent('keydown', { key: gesture, bubbles: true }));
            info.dispatchEvent(new KeyboardEvent('keyup', { key: gesture, bubbles: true }));
        }
        expect(actions).toHaveLength(1);
        expect(actions[0].config.tap_action).toEqual({ action: 'more-info' });
    });

    it.each([
        { action: 'perform-action', perform_action: 'light.turn_off', data: { transition: 2 }, target: { entity_id: 'light.test' } },
        { action: 'assist', pipeline_id: 'preferred', start_listening: false },
        { action: 'call-service', service: 'light.turn_off', service_data: { transition: 1 } },
    ])('delegates $action and its parameters to Home Assistant', async (tap_action) => {
        const confirmation = { text: 'Confirm?', exemptions: [{ user: 'test' }] };
        const card = await mount({ entity: 'light.test', tap_action: { ...tap_action, confirmation } });
        const listener = vi.fn(); document.body.addEventListener('hass-action', listener, { once: true });
        click(card.shadowRoot!.querySelector('.title')!);
        expect(listener).toHaveBeenCalledOnce();
        const event = listener.mock.calls[0][0] as CustomEvent;
        expect(event.composed).toBe(true);
        expect(event.detail).toMatchObject({ action: 'tap', config: { entity: 'light.test', tap_action: { ...tap_action, confirmation } } });
    });

    it('refreshes double-tap options on an existing region', async () => {
        vi.useFakeTimers();
        const card = await mount({ rows: [{ entities: ['light.test'] }] });
        const target = card.shadowRoot!.querySelector('.entities-row .entity')!;
        const actions: string[] = [];
        target.addEventListener('action', (e) => actions.push((e as CustomEvent).detail.action));
        card.setConfig({ type: 'custom:modern-room-card', rows: [{ entities: [{ entity: 'light.test', double_tap_action: { action: 'more-info' } }] }] } as any);
        await card.updateComplete;
        expect(card.shadowRoot!.querySelector('.entities-row .entity')).toBe(target);
        click(target); click(target); vi.advanceTimersByTime(300);
        expect(actions).toEqual(['double_tap']);
    });

    it.each([false, true])('recognizes hold only when configured: %s', async (hasHold) => {
        vi.useFakeTimers();
        const card = await mount({ entity: 'light.test', ...(hasHold ? { hold_action: { action: 'more-info' } } : {}) });
        const actions: string[] = [];
        const target = card.shadowRoot!.querySelector('.title')!;
        target.addEventListener('action', (e) => actions.push((e as CustomEvent).detail.action));
        pointer(target, 'pointerdown'); vi.advanceTimersByTime(550); pointer(target, 'pointerup'); pointer(target, 'click');
        expect(actions).toEqual([hasHold ? 'hold' : 'tap']);
    });

    it('cancels delayed actions on removal and binds again on reconnect', async () => {
        vi.useFakeTimers();
        const card = await mount({ entity: 'light.test', double_tap_action: { action: 'more-info' } });
        const actions = vi.fn(); card.addEventListener('hass-action', actions);
        click(card.shadowRoot!.querySelector('.title')!); card.remove(); vi.advanceTimersByTime(300);
        expect(actions).not.toHaveBeenCalled();
        document.body.append(card); click(card.shadowRoot!.querySelector('.title')!); vi.advanceTimersByTime(300);
        expect(actions).toHaveBeenCalledOnce();
    });

    it('emits explicit none from the editor and preserves action configuration', async () => {
        const editor = new ModernRoomCardEditor(); editor.hass = hass();
        editor.setConfig({ type: 'custom:modern-room-card', entity: 'light.test', rows: [] } as any);
        document.body.append(editor); mounted.push(editor); await editor.updateComplete;
        const changes: any[] = []; editor.addEventListener('config-changed', (e) => changes.push((e as CustomEvent).detail.config));
        const select = editor.shadowRoot!.querySelector('.action-controls ha-select')!;
        select.dispatchEvent(new CustomEvent('selected', { detail: { value: 'none' } }));
        expect(changes[0].tap_action).toEqual({ action: 'none' });
    });
});

describe('release rendering regressions', () => {
    it.each([
        { entity: 'light.missing' },
        { info_entities: [{ entity: 'light.test', attribute: 'brightness', format: 'brightness' }] },
        { info_entities: [{ entity: 'light.test', attribute: 'timestamp', format: 'date' }] },
        { rows: [{ entities: [{ entity: 'light.test', icon: 'mdi:lamp' }] }] },
        { rows: [{ entities: [{ entity: 'light.test', icon: { conditions: [{ entity: 'sensor.missing', condition: 'not_equals', value: 'on' }] } }] }] },
    ])('retains the card for missing data or an explicit icon: %j', async (config) => {
        const card = await mount({ title: 'Room', ...config });
        expect(card.shadowRoot!.querySelector('hui-warning')).toBeNull();
        expect(card.shadowRoot!.querySelector('.title-text')?.textContent).toBe('Room');
    });

    it('reports style-template errors and recovers when the attribute arrives', async () => {
        const card = await mount({ entity: 'light.test', card_styles: { template: "return 'opacity:' + entity.attributes.brightness.toString();" } });
        expect(card.shadowRoot!.querySelector('hui-warning')?.textContent).toContain('ModernRoomCardJSTemplateError');
        card.hass = hass('on', { brightness: 1 }); await card.updateComplete;
        expect(card.shadowRoot!.querySelector('hui-warning')).toBeNull();
    });

    it('throws invalid configuration synchronously', () => {
        const card = new ModernRoomCard();
        expect(() => card.setConfig({ type: 'custom:modern-room-card', content_size: 'bad', rows: [] } as any)).toThrow('content_size');
    });

    it('preserves nested instances, focus, and local values through unrelated updates', async () => {
        const created: HTMLElement[] = [];
        const factory = vi.fn(() => { const el = document.createElement('input'); created.push(el); return el; });
        (window as any).loadCardHelpers = async () => ({ createCardElement: factory });
        const config = { cards: [{ type: 'test' }] };
        const card = await mount(config);
        await (card as any).helpersPromise; await card.updateComplete;
        const child = created[0] as HTMLInputElement; child.value = 'unsaved'; child.focus();
        const render = vi.spyOn(card, 'render');
        const updated = { ...card.hass, states: { ...card.hass.states, 'sensor.other': entity('10') } };
        card.hass = updated; await card.updateComplete;
        expect(render).not.toHaveBeenCalled();
        expect(factory).toHaveBeenCalledOnce();
        expect((child as any).hass).toBe(updated);
        expect(child.value).toBe('unsaved'); expect(card.shadowRoot!.activeElement).toBe(child);
        card.setConfig({ type: 'custom:modern-room-card', ...config, title: 'Changed' } as any); await card.updateComplete;
        expect(factory).toHaveBeenCalledOnce();
        card.setConfig({ type: 'custom:modern-room-card', cards: [{ type: 'test', name: 'new' }] } as any); await card.updateComplete;
        expect(factory).toHaveBeenCalledTimes(2);
    });

    it('updates row visibility from a condition-only entity', async () => {
        const card = await mount({ rows: [{ hide_if: { conditions: [{ entity: 'sensor.other', condition: 'equals', value: 'on' }] }, entities: ['light.test'] }] });
        expect(card.shadowRoot!.querySelector('.entities-row')).not.toBeNull();
        card.hass = { ...card.hass, states: { ...card.hass.states, 'sensor.other': entity('on') } }; await card.updateComplete;
        expect(card.shadowRoot!.querySelector('.entities-row')).toBeNull();
    });
});
