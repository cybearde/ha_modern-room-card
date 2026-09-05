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
        expect(ModernRoomCard.getStubConfig()).toEqual({ title: 'Living Room', entities: [] });
        expect(ModernRoomCard.getStubConfig()).not.toHaveProperty('type');
    });

    it('normalizes strings only when the editor needs object fields', () => {
        expect(normalizeEntityConfig('light.office')).toEqual({ entity: 'light.office' });
        expect(normalizeEntityConfig({ entity: 'light.desk' } as any)).toEqual({ entity: 'light.desk' });
    });

    it('preserves untouched string-form entities and edits them safely', () => {
        const editor = createEditor({ entities: ['light.office', 'light.desk'] });

        internals(editor)._updateEntity('entities', 1, { name: 'Desk' });

        expect(internals(editor)._config.entities).toEqual([
            'light.office',
            { entity: 'light.desk', name: 'Desk' },
        ]);
    });

    it('adds and removes entities', () => {
        const editor = createEditor({ entities: ['light.office'] });
        internals(editor)._addEntity();
        expect(internals(editor)._config.entities).toHaveLength(2);

        internals(editor)._removeEntity('entities', 0);
        expect(internals(editor)._config.entities).toEqual([{}]);
    });

    it('adds explicit empty slots to the main row and nested rows', () => {
        const editor = createEditor({ entities: ['light.office'], rows: [{ entities: ['light.desk'] }] });

        internals(editor)._addEmptySlot();
        internals(editor)._addRowEmptySlot(0);

        expect(internals(editor)._config.entities).toEqual(['light.office', {}]);
        expect(internals(editor)._config.rows[0].entities).toEqual(['light.desk', {}]);
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
            show_icon: true,
            hide_if: { conditions: [{ condition: 'equals', value: 'off' }] },
            tap_action: { action: 'navigate', navigation_path: '/office' },
            entities: ['light.office', {}],
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
});
