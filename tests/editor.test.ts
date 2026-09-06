import { beforeEach, describe, expect, it } from 'vitest';
import {
    ModernRoomCardEditor,
    editorConfigFromYaml,
    editorConfigToYaml,
    normalizeEntityConfig,
} from '../src/editor';
import ModernRoomCard from '../src/index';

const createEditor = (config: Record<string, unknown> = {}): ModernRoomCardEditor => {
    const editor = document.createElement('modern-room-card-editor') as ModernRoomCardEditor;
    editor.setConfig({ type: 'custom:modern-room-card', ...config } as any);
    return editor;
};

const internals = (editor: ModernRoomCardEditor): any => editor;

describe('visual editor configuration', () => {
    beforeEach(() => document.body.replaceChildren());

    it('is exposed through the Home Assistant custom-card contract', async () => {
        const editor = await ModernRoomCard.getConfigElement();
        expect(customElements.get('modern-room-card-editor')).toBe(ModernRoomCardEditor);
        expect(editor.tagName.toLowerCase()).toBe('modern-room-card-editor');
        expect(ModernRoomCard.getStubConfig()).toEqual({ title: 'Living Room', rows: [{ entities: [] }] });
        expect(ModernRoomCard.getStubConfig()).not.toHaveProperty('type');
    });

    it('aligns the main pickers and renders info entities before rows', async () => {
        const editor = createEditor();
        editor.hass = { states: {} } as any;
        document.body.append(editor);
        await editor.updateComplete;

        const pickers = editor.shadowRoot!.querySelectorAll('.main-picker');
        const infoSection = editor.shadowRoot!.querySelector('.info-entities-section')!;
        const rowsSection = Array.from(editor.shadowRoot!.querySelectorAll('.section')).find((section) =>
            section.querySelector('.section-header span')?.textContent?.includes('Rows'),
        )!;
        const appearanceSection = editor.shadowRoot!.querySelector('.appearance-section')!;

        expect(pickers).toHaveLength(2);
        expect(editor.shadowRoot!.querySelector('.main-picker-label')?.textContent).toContain('Main entity and icon');
        const pickerGroup = editor.shadowRoot!.querySelector('.main-picker-group')!;
        const titleField = editor.shadowRoot!.querySelector('.main-title-field')!;
        expect(titleField.tagName.toLowerCase()).toBe('ha-input');
        expect(pickerGroup.contains(titleField)).toBe(false);
        expect(pickerGroup.compareDocumentPosition(titleField) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(titleField.parentElement?.classList.contains('main-picker-field')).toBe(true);
        expect(editor.shadowRoot!.querySelector('.main-title-field-row')).toBeNull();
        expect(editor.shadowRoot!.querySelector('.title-name-input')).toBeNull();
        expect(editor.shadowRoot!.querySelector('ha-textfield')).toBeNull();
        expect(Array.from(pickers).every((picker) => !(picker as any).label)).toBe(true);
        expect(pickers[0].getAttribute('aria-label')).toBe('Main entity');
        expect(pickers[1].getAttribute('aria-label')).toBe('Main icon');
        expect(ModernRoomCardEditor.styles.cssText).not.toContain('ha-icon-picker.main-picker');
        expect(editor.shadowRoot!.querySelectorAll('.config-section')).toHaveLength(4);
        expect(editor.shadowRoot!.querySelector('.main-config-section .section-description')?.textContent).toContain(
            'header',
        );
        expect(infoSection.querySelector('.section-description')?.textContent).toContain('top-right');
        expect(rowsSection.querySelector('.section-description')?.textContent).toContain('empty slots');
        expect(ModernRoomCardEditor.styles.cssText).toContain('border-top: 4px solid var(--section-accent)');
        expect(infoSection.compareDocumentPosition(rowsSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(rowsSection.compareDocumentPosition(appearanceSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(editor.shadowRoot!.querySelector('.section-header span')?.textContent).not.toBe('Entities');
    });

    it('edits the title and a row entity display name through explicit visual fields', async () => {
        const editor = createEditor({
            title: 'Living room',
            rows: [{ entities: ['light.office'] }],
        });
        editor.hass = {
            states: {
                'light.office': {
                    entity_id: 'light.office',
                    state: 'on',
                    attributes: { friendly_name: 'Office light' },
                },
            },
        } as any;
        document.body.append(editor);
        await editor.updateComplete;

        const titleInput = editor.shadowRoot!.querySelector('.main-title-field') as HTMLElement & {
            label: string;
            value: string;
        };
        expect(titleInput.label).toBe('Title');
        titleInput.value = 'Office';
        titleInput.dispatchEvent(new Event('change'));
        await editor.updateComplete;

        const entityNameInput = editor.shadowRoot!.querySelector('.rows-section .entity-name-input') as HTMLElement & {
            label: string;
            value: string;
        };
        expect(entityNameInput.label).toBe('Entity name (optional)');
        entityNameInput.value = 'Desk lamp';
        entityNameInput.dispatchEvent(new Event('change'));
        await editor.updateComplete;

        expect(internals(editor)._config.title).toBe('Office');
        expect(internals(editor)._config.rows[0].entities[0]).toEqual({
            entity: 'light.office',
            name: 'Desk lamp',
        });
        expect((editor.shadowRoot!.querySelector('.rows-section .row-editor > ha-expansion-panel') as any).header).toBe(
            'Desk lamp',
        );
    });

    it('edits show_icon for info entities without adding the control to row entities', async () => {
        const editor = createEditor({
            info_entities: [{ entity: 'sensor.temperature', show_icon: true }],
            rows: [{ entities: ['light.office'] }],
        });
        editor.hass = {
            states: {
                'sensor.temperature': {
                    entity_id: 'sensor.temperature',
                    state: '21',
                    attributes: { friendly_name: 'Temperature' },
                },
                'light.office': {
                    entity_id: 'light.office',
                    state: 'on',
                    attributes: { friendly_name: 'Office light' },
                },
            },
        } as any;
        document.body.append(editor);
        await editor.updateComplete;

        const toggle = editor.shadowRoot!.querySelector(
            '.info-entities-section .info-show-icon',
        ) as HTMLElement & { checked: boolean };
        expect(toggle.checked).toBe(true);
        expect(editor.shadowRoot!.querySelector('.rows-section .info-show-icon')).toBeNull();

        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));

        expect(internals(editor)._config.info_entities[0]).toEqual({
            entity: 'sensor.temperature',
            show_icon: false,
        });
    });

    it('replaces picker state when the same editor instance is used for another card', async () => {
        const editor = createEditor({
            entity: 'light.office',
            icon: 'mdi:desk',
            rows: [{ entities: ['light.office'] }],
        });
        editor.hass = { states: {} } as any;
        document.body.append(editor);
        await editor.updateComplete;

        editor.setConfig({
            type: 'custom:modern-room-card',
            entity: 'light.kitchen',
            icon: 'mdi:stove',
            rows: [{ entities: ['light.kitchen'] }],
        } as any);
        await editor.updateComplete;

        const entityPickers = editor.shadowRoot!.querySelectorAll('ha-entity-picker') as NodeListOf<HTMLElement & {
            value: string;
        }>;
        const iconPicker = editor.shadowRoot!.querySelector('ha-icon-picker') as HTMLElement & { value: string };
        expect(entityPickers[0].value).toBe('light.kitchen');
        expect(entityPickers[1].value).toBe('light.kitchen');
        expect(iconPicker.value).toBe('mdi:stove');
        expect((editor.shadowRoot!.querySelectorAll('ha-expansion-panel')[1] as any).header).toBe('light.kitchen');
    });

    it('keeps incoming and emitted card configuration detached from editor changes', () => {
        const source = {
            type: 'custom:modern-room-card',
            rows: [{ entities: [{ entity: 'light.office' }] }],
        } as any;
        const editor = createEditor(source);
        let emitted: any;
        editor.addEventListener('config-changed', (ev) => {
            emitted = (ev as CustomEvent).detail.config;
        });

        internals(editor)._updateRowEntity(0, 0, { name: 'Office' });
        emitted.rows[0].entities[0].name = 'Changed outside';

        expect(source.rows[0].entities).toEqual([{ entity: 'light.office' }]);
        expect(internals(editor)._config.rows[0].entities[0].name).toBe('Office');
    });

    it('normalizes strings only when the editor needs object fields', () => {
        expect(normalizeEntityConfig('light.office')).toEqual({ entity: 'light.office' });
        expect(normalizeEntityConfig({ entity: 'light.desk' } as any)).toEqual({ entity: 'light.desk' });
    });

    it('preserves untouched string-form row entities and edits them safely', () => {
        const editor = createEditor({ rows: [{ entities: ['light.office', 'light.desk'] }] });

        internals(editor)._updateRowEntity(0, 1, { name: 'Desk' });

        expect(internals(editor)._config.rows[0].entities).toEqual([
            'light.office',
            { entity: 'light.desk', name: 'Desk' },
        ]);
    });

    it('adds and removes rows and their entities', () => {
        const editor = createEditor({ rows: [{ entities: ['light.office'] }] });
        internals(editor)._addRowEntity(0);
        expect(internals(editor)._config.rows[0].entities).toHaveLength(2);

        internals(editor)._removeRowEntity(0, 0);
        expect(internals(editor)._config.rows[0].entities).toEqual([{}]);
    });

    it('adds explicit empty slots to rows', () => {
        const editor = createEditor({ rows: [{ entities: ['light.desk'] }] });

        internals(editor)._addRowEmptySlot(0);

        expect(internals(editor)._config.rows[0].entities).toEqual(['light.desk', {}]);
    });

    it('edits the compact layout and per-slot width', () => {
        const editor = createEditor({ rows: [{ entities: [{}] }] });

        internals(editor)._layoutChanged(new CustomEvent('selected', { detail: { value: 'compact' } }));
        internals(editor)._updateRowEntity(0, 0, { width: '10px' });

        expect(internals(editor)._config.layout).toBe('compact');
        expect(internals(editor)._config.rows[0].entities).toEqual([{ width: '10px' }]);
    });

    it('exposes the main icon state-color default and explicit opt-out', async () => {
        const editor = createEditor();
        editor.hass = { states: {} } as any;
        const emitted: any[] = [];
        editor.addEventListener('config-changed', (ev) => emitted.push((ev as CustomEvent).detail.config));
        document.body.append(editor);
        await editor.updateComplete;

        const toggle = editor.shadowRoot!.querySelector('.main-state-color') as HTMLElement & { checked: boolean };
        expect(toggle.checked).toBe(true);
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
        expect(emitted.at(-1).state_color).toBe(false);

        toggle.checked = true;
        toggle.dispatchEvent(new Event('change'));
        expect(emitted.at(-1)).not.toHaveProperty('state_color');
    });

    it('uses the current Home Assistant select contract for layout and actions', async () => {
        const editor = createEditor();
        editor.hass = { states: {} } as any;
        document.body.append(editor);
        await editor.updateComplete;

        const selects = editor.shadowRoot!.querySelectorAll('ha-select') as NodeListOf<HTMLElement & {
            options: Array<{ value: string; label: string }>;
        }>;
        expect(editor.shadowRoot!.querySelector('ha-list-item')).toBeNull();
        expect(selects[0].options.map((option) => option.value)).toEqual(['default', 'compact']);

        selects[0].dispatchEvent(new CustomEvent('selected', { detail: { value: 'compact' } }));
        selects[3].dispatchEvent(new CustomEvent('selected', { detail: { value: 'toggle' } }));

        expect(internals(editor)._config.layout).toBe('compact');
        expect(internals(editor)._config.tap_action).toEqual({ action: 'toggle' });
    });

    it('keeps existing selector values synchronized without emitting or normalizing them away', async () => {
        const source = {
            type: 'custom:modern-room-card',
            title: 'Living room',
            layout: 'compact',
            content_size: 'large',
            title_wrap: 'ellipsis',
            appearance: { transition: 'subtle', states: [] },
            rows: [],
        } as any;
        const editor = createEditor(source);
        editor.hass = { states: {} } as any;
        let eventCount = 0;
        editor.addEventListener('config-changed', () => eventCount++);
        document.body.append(editor);
        await editor.updateComplete;

        expect((editor.shadowRoot!.querySelector('.layout-select') as any).value).toBe('compact');
        expect((editor.shadowRoot!.querySelector('.content-size-select') as any).value).toBe('large');
        expect((editor.shadowRoot!.querySelector('.title-wrap-select') as any).value).toBe('ellipsis');
        expect((editor.shadowRoot!.querySelector('.appearance-transition') as any).value).toBe('subtle');
        expect(internals(editor)._config).toMatchObject({
            layout: 'compact',
            content_size: 'large',
            title_wrap: 'ellipsis',
            appearance: { transition: 'subtle' },
        });
        expect(editorConfigFromYaml(internals(editor)._advancedYaml)).toMatchObject({ layout: 'compact' });
        expect(eventCount).toBe(0);

        // The host owns Save/Cancel. Its source object remains unchanged until it accepts an emitted clone.
        internals(editor)._layoutChanged(new CustomEvent('selected', { detail: { value: 'default' } }));
        expect(eventCount).toBe(1);
        expect(internals(editor)._config).not.toHaveProperty('layout');
        expect(source.layout).toBe('compact');
    });

    it.each([
        ['content_size', '_contentSizeChanged', 'large', 'default'],
        ['title_wrap', '_titleWrapChanged', 'ellipsis', 'auto'],
    ] as const)('emits exactly one expected change for %s', (property, handler, initial, next) => {
        const editor = createEditor({ [property]: initial });
        const emitted: any[] = [];
        editor.addEventListener('config-changed', (ev) => emitted.push((ev as CustomEvent).detail.config));

        internals(editor)[handler](new CustomEvent('selected', { detail: { value: next } }));

        expect(emitted).toHaveLength(1);
        expect(emitted[0]).not.toHaveProperty(property);
    });

    it('emits exactly one expected appearance transition change', () => {
        const editor = createEditor({ appearance: { transition: 'subtle', states: [] } });
        const emitted: any[] = [];
        editor.addEventListener('config-changed', (ev) => emitted.push((ev as CustomEvent).detail.config));

        internals(editor)._appearanceTransitionChanged(new CustomEvent('selected', { detail: { value: 'none' } }));

        expect(emitted).toHaveLength(1);
        expect(emitted[0].appearance).toEqual({ transition: 'none', states: [] });
    });

    it('passes compact configuration through to a card preview', async () => {
        const editor = createEditor({ layout: 'compact', rows: [] });
        const preview = new ModernRoomCard();
        await preview.setConfig(internals(editor)._config);
        preview.hass = { states: {}, locale: { language: 'en' }, localize: (key: string) => key } as any;
        document.body.append(preview);
        await preview.updateComplete;

        expect(preview.shadowRoot!.querySelector('ha-card')!.classList.contains('compact')).toBe(true);
    });

    it('defines responsive containment without hiding horizontal overflow', () => {
        const css = ModernRoomCardEditor.styles.cssText;
        expect(css).toContain('grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr))');
        expect(css).toContain('@media (max-width: 600px)');
        expect(css).toContain('@media (max-width: 400px)');
        expect(css).toContain('padding-bottom: max(80px, env(safe-area-inset-bottom))');
        expect(css).not.toContain('overflow-x: hidden');
    });

    it('edits title size, content size, and title overflow independently', () => {
        const editor = createEditor();

        internals(editor)._titleSizeChanged({ currentTarget: { value: '24' } });
        internals(editor)._contentSizeChanged(new CustomEvent('selected', { detail: { value: 'large' } }));
        internals(editor)._titleWrapChanged(new CustomEvent('selected', { detail: { value: 'ellipsis' } }));

        expect(internals(editor)._config.title_size).toBe(24);
        expect(internals(editor)._config.content_size).toBe('large');
        expect(internals(editor)._config.title_wrap).toBe('ellipsis');

        internals(editor)._titleSizeChanged({ currentTarget: { value: '100' } });
        expect(internals(editor)._config.title_size).toBe(40);
    });

    it('renders title size as a bounded slider with a live value', async () => {
        const editor = createEditor();
        editor.hass = { states: {} } as any;
        document.body.append(editor);
        await editor.updateComplete;

        const slider = editor.shadowRoot!.querySelector('ha-slider') as HTMLElement & {
            min: number;
            max: number;
            step: number;
            value: number;
        };
        expect(slider.getAttribute('aria-label')).toBe('Title size');
        expect(slider.min).toBe(12);
        expect(slider.max).toBe(40);
        expect(slider.step).toBe(1);
        expect(slider.value).toBe(18);
        expect(editor.shadowRoot!.querySelector('.title-size-value')?.textContent).toBe('18px');

        slider.value = 24;
        slider.dispatchEvent(new Event('change'));
        await editor.updateComplete;

        expect(internals(editor)._config.title_size).toBe(24);
        expect(editor.shadowRoot!.querySelector('.title-size-value')?.textContent).toBe('24px');
    });

    it('renders all common appearance-rule controls', async () => {
        const editor = createEditor({
            appearance: {
                transition: 'subtle',
                states: [{ entity: 'light.office', condition: 'equals', value: 'on', priority: 10 }],
            },
        });
        editor.hass = {
            states: {
                'light.office': { entity_id: 'light.office', state: 'on', attributes: {} },
            },
        } as any;
        document.body.append(editor);
        await editor.updateComplete;

        const section = editor.shadowRoot!.querySelector('.appearance-section')!;
        expect(section.querySelector('.section-description')?.textContent).toContain('background, accent, and foreground');
        expect(section.querySelector('.appearance-help')?.textContent).toContain('highest-priority');
        expect((section.querySelector('.appearance-transition') as any).value).toBe('subtle');
        expect(section.querySelectorAll('.appearance-rule')).toHaveLength(1);
        expect(section.querySelector('ha-entity-picker')).not.toBeNull();
        expect(section.querySelector('.appearance-condition')).not.toBeNull();
        expect(section.querySelector('.appearance-value')).not.toBeNull();
        expect(section.querySelector('.appearance-priority')).not.toBeNull();
        expect(section.querySelectorAll('.appearance-color-grid ha-input')).toHaveLength(3);
        expect(section.querySelector('ha-slider[aria-label="Background opacity"]')).not.toBeNull();
    });

    it('creates, edits, reorders, and removes appearance rules while emitting config changes', () => {
        const editor = createEditor();
        let eventCount = 0;
        editor.addEventListener('config-changed', () => eventCount++);

        internals(editor)._addAppearanceRule();
        internals(editor)._updateAppearanceRule(0, {
            entity: 'light.office',
            condition: 'equals',
            value: 'on',
            background: 'entity-color',
            accent: 'var(--warning-color)',
            foreground: 'white',
        });
        internals(editor)._appearancePriorityChanged(0, { currentTarget: { value: '25' } });
        internals(editor)._appearanceOpacityChanged(0, { currentTarget: { value: '2' } });
        internals(editor)._appearanceTransitionChanged(
            new CustomEvent('selected', { detail: { value: 'subtle' } }),
        );
        internals(editor)._addAppearanceRule();
        internals(editor)._updateAppearanceRule(1, {
            entity: 'binary_sensor.alert',
            condition: 'equals',
            value: 'on',
            priority: 100,
        });
        internals(editor)._moveAppearanceRule(1, -1);

        expect(internals(editor)._config.appearance.transition).toBe('subtle');
        expect(internals(editor)._config.appearance.states[0].entity).toBe('binary_sensor.alert');
        expect(internals(editor)._config.appearance.states[1]).toMatchObject({
            entity: 'light.office',
            background: 'entity-color',
            accent: 'var(--warning-color)',
            foreground: 'white',
            priority: 25,
            opacity: 1,
        });

        internals(editor)._updateAppearanceRule(1, { foreground: undefined, opacity: undefined });
        expect(internals(editor)._config.appearance.states[1]).not.toHaveProperty('foreground');
        expect(internals(editor)._config.appearance.states[1]).not.toHaveProperty('opacity');
        internals(editor)._removeAppearanceRule(0);
        expect(internals(editor)._config.appearance.states).toHaveLength(1);
        expect(eventCount).toBeGreaterThanOrEqual(9);
    });

    it('adds, edits, and deletes rows without converting untouched strings', () => {
        const editor = createEditor({ rows: [{ entities: ['light.office'] }] });
        internals(editor)._updateRowEntity(0, 0, { name: 'Office' });
        expect(internals(editor)._config.rows[0].entities[0]).toEqual({ entity: 'light.office', name: 'Office' });

        internals(editor)._addRow();
        expect(internals(editor)._config.rows).toHaveLength(2);
        internals(editor)._removeRow(1);
        expect(internals(editor)._config.rows).toHaveLength(1);
    });

    it('round-trips the complete YAML configuration', () => {
        const source = {
            type: 'custom:modern-room-card',
            title: 'Office',
            layout: 'compact',
            title_size: 24,
            content_size: 'large',
            title_wrap: 'ellipsis',
            appearance: {
                transition: 'subtle',
                states: [
                    {
                        entity: 'binary_sensor.alert',
                        condition: 'equals',
                        value: 'on',
                        background: 'var(--error-color)',
                        priority: 100,
                    },
                ],
            },
            show_icon: true,
            hide_if: { conditions: [{ condition: 'equals', value: 'off' }] },
            tap_action: { action: 'navigate', navigation_path: '/office' },
            rows: [{ content_alignment: 'center', entities: ['light.office', { width: 10 }] }],
            cards: [{ type: 'thermostat', entity: 'climate.office' }],
        } as any;

        expect(editorConfigFromYaml(editorConfigToYaml(source))).toEqual(source);
    });

    it('rejects invalid YAML and does not apply it', () => {
        const editor = createEditor({ title: 'Before' });
        internals(editor)._advancedChanged(new CustomEvent('value-changed', { detail: { value: 'title: [bad' } }));

        expect(internals(editor)._advancedError).toBe(true);
        expect(internals(editor)._config.title).toBe('Before');
    });

    it('rejects an unknown layout preset', () => {
        expect(() => editorConfigFromYaml('layout: squeezed')).toThrow("layout must be 'default' or 'compact'.");
    });

    it('rejects invalid sizing options', () => {
        expect(() => editorConfigFromYaml('title_size: 41')).toThrow('title_size must be a number between 12 and 40');
        expect(() => editorConfigFromYaml('content_size: huge')).toThrow(
            "content_size must be 'small', 'default', or 'large'",
        );
        expect(() => editorConfigFromYaml('title_wrap: shrink')).toThrow(
            "title_wrap must be 'auto', 'wrap', or 'ellipsis'",
        );
    });

    it('rejects invalid appearance values in advanced YAML', () => {
        expect(() => editorConfigFromYaml('appearance:\n  transition: pulse')).toThrow('appearance.transition');
        expect(() => editorConfigFromYaml('appearance:\n  states:\n    - opacity: 1.5')).toThrow(
            'opacity must be between 0 and 1',
        );
        expect(() => editorConfigFromYaml('appearance:\n  states:\n    - priority: high')).toThrow(
            'priority must be numeric',
        );
    });

    it('rejects removed top-level entity fields', () => {
        expect(() => editorConfigFromYaml('entities: []')).toThrow('Top-level entities are no longer supported');
        expect(() => editorConfigFromYaml('content_alignment: center')).toThrow(
            'Top-level content_alignment is no longer supported',
        );
    });
});
