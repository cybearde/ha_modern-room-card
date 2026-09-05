import { css, CSSResult, html, LitElement, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ActionConfig, fireEvent, HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import * as yaml from 'js-yaml';
import { RoomCardAlignment, RoomCardConfig, RoomCardEntity, RoomCardRow } from './types';

const ADVANCED_KEYS = ['cards', 'templates', 'card_styles', 'styles'] as const;

const STRUCTURED_KEYS = [
    'type',
    'title',
    'entity',
    'icon',
    'entities',
    'info_entities',
    'rows',
    'hide_title',
    'content_alignment',
] as const;

const pick = <T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Partial<T> => {
    const result: Partial<T> = {};
    for (const key of keys) {
        const value = obj[key];
        if (value !== undefined) {
            result[key] = value;
        }
    }
    return result;
};

const eventTarget = (ev: Event): any => ev.currentTarget;

@customElement('modern-room-card-editor')
export class ModernRoomCardEditor extends LitElement implements LovelaceCardEditor {
    @property() public hass!: HomeAssistant;

    private _config!: Partial<RoomCardConfig>;

    private _advancedYaml = '';

    private _advancedError = false;

    public setConfig(config: RoomCardConfig): void {
        this._config = {
            entities: [],
            info_entities: [],
            rows: [],
            ...config,
        };
        this._deriveAdvancedYaml();
    }

    static get styles(): CSSResult {
        return css`
            .card-config {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .row {
                display: flex;
                flex-direction: row;
                gap: 8px;
                align-items: center;
                padding: 4px 0;
            }
            .grow {
                flex: 1;
            }
            .section {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-top: 8px;
            }
            .section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 14px;
                font-weight: 500;
            }
            .entity-editor,
            .row-editor {
                display: flex;
                flex-direction: column;
                padding: 8px 0;
            }
            .options {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding: 4px 0;
            }
            ha-expansion-panel {
                --expansion-panel-content-padding: 0 8px;
            }
        `;
    }

    protected render(): TemplateResult {
        if (!this.hass || !this._config) return html``;

        return html`
            <div class="card-config">
                <div class="row">
                    <ha-textfield
                        class="grow"
                        .label=${'Title'}
                        .value=${(this._config.title as string) ?? ''}
                        @change=${this._titleChanged}
                    ></ha-textfield>
                </div>

                <div class="row">
                    <ha-entity-picker
                        class="grow"
                        .hass=${this.hass}
                        .label=${'Main entity (optional)'}
                        allow-custom-entity
                        .value=${typeof this._config.entity === 'string' ? this._config.entity : ''}
                        @value-changed=${this._mainEntityChanged}
                    ></ha-entity-picker>
                    <ha-icon-picker
                        .hass=${this.hass}
                        .label=${'Main icon'}
                        .value=${typeof this._config.icon === 'string' ? this._config.icon : ''}
                        @value-changed=${this._mainIconChanged}
                    ></ha-icon-picker>
                </div>

                <div class="row">
                    <ha-formfield .label=${'Hide title'}>
                        <ha-switch
                            .checked=${this._config.hide_title === true}
                            @change=${this._hideTitleChanged}
                        ></ha-switch>
                    </ha-formfield>
                    <ha-select
                        class="grow"
                        .label=${'Content alignment'}
                        .value=${(this._config.content_alignment as string) ?? 'left'}
                        @change=${this._alignmentChanged}
                    >
                        <mwc-list-item value="left">Left</mwc-list-item>
                        <mwc-list-item value="center">Center</mwc-list-item>
                        <mwc-list-item value="right">Right</mwc-list-item>
                    </ha-select>
                </div>

                <div class="section">
                    <div class="section-header">
                        <span>Entities</span>
                        <ha-button @click=${this._addEntity}>Add entity</ha-button>
                    </div>
                    ${(this._config.entities ?? []).map((entity, index) =>
                        this._renderEntityEditor(
                            entity,
                            this._entityHeader(entity, index),
                            (patch) => this._updateEntity('entities', index, patch),
                            () => this._removeEntity('entities', index),
                        ),
                    )}
                </div>

                <div class="section">
                    <div class="section-header">
                        <span>Info entities (top-right)</span>
                        <ha-button @click=${this._addInfoEntity}>Add</ha-button>
                    </div>
                    ${(this._config.info_entities ?? []).map((entity, index) =>
                        this._renderEntityEditor(
                            entity,
                            this._entityHeader(entity, index),
                            (patch) => this._updateEntity('info_entities', index, patch),
                            () => this._removeEntity('info_entities', index),
                        ),
                    )}
                </div>

                <div class="section">
                    <div class="section-header">
                        <span>Rows</span>
                        <ha-button @click=${this._addRow}>Add row</ha-button>
                    </div>
                    ${(this._config.rows ?? []).map((row, rowIndex) => this._renderRowEditor(row, rowIndex))}
                </div>

                <div class="section">
                    <ha-expansion-panel .header=${'Advanced (YAML)'}>
                        <ha-code-editor
                            mode="yaml"
                            .error=${this._advancedError}
                            .value=${this._advancedYaml}
                            @value-changed=${this._advancedChanged}
                        ></ha-code-editor>
                    </ha-expansion-panel>
                </div>
            </div>
        `;
    }

    private _renderEntityEditor(
        entity: RoomCardEntity | undefined,
        header: string,
        onPatch: (patch: Partial<RoomCardEntity>) => void,
        onRemove: () => void,
    ): TemplateResult {
        return html`
            <ha-expansion-panel .header=${header}>
                <div class="entity-editor">
                    <div class="row">
                        <ha-entity-picker
                            class="grow"
                            .hass=${this.hass}
                            allow-custom-entity
                            .value=${entity?.entity ?? ''}
                            @value-changed=${(ev: Event) =>
                                onPatch({ entity: ((ev as CustomEvent).detail.value as string) ?? '' })}
                        ></ha-entity-picker>
                        <ha-icon-button .label=${'Delete'} @click=${onRemove}>
                            <ha-icon icon="mdi:delete"></ha-icon>
                        </ha-icon-button>
                    </div>
                    <div class="row">
                        <ha-textfield
                            class="grow"
                            .label=${'Name'}
                            .value=${(entity?.name as string) ?? ''}
                            @change=${(ev: Event) =>
                                onPatch({ name: (eventTarget(ev) as HTMLInputElement).value })}
                        ></ha-textfield>
                    </div>
                    <div class="row">
                        <ha-icon-picker
                            class="grow"
                            .hass=${this.hass}
                            .label=${'Icon (overrides domain icon)'}
                            .value=${typeof entity?.icon === 'string' ? entity.icon : ''}
                            @value-changed=${(ev: Event) =>
                                onPatch({ icon: ((ev as CustomEvent).detail.value as string) ?? '' })}
                        ></ha-icon-picker>
                    </div>
                    <div class="row">
                        <ha-select
                            class="grow"
                            .label=${'Tap action'}
                            .value=${entity?.tap_action?.action ?? ''}
                            @change=${(ev: Event) =>
                                onPatch({
                                    tap_action: this._tapActionFromValue(
                                        (eventTarget(ev) as HTMLSelectElement).value,
                                    ),
                                })}
                        >
                            <mwc-list-item value="">None</mwc-list-item>
                            <mwc-list-item value="toggle">Toggle</mwc-list-item>
                            <mwc-list-item value="more-info">Show more-info</mwc-list-item>
                        </ha-select>
                    </div>
                    <div class="options">
                        <ha-formfield .label=${'Show name'}>
                            <ha-switch
                                .checked=${entity?.show_name !== false}
                                @change=${(ev: Event) =>
                                    onPatch({ show_name: (eventTarget(ev) as HTMLInputElement).checked })}
                            ></ha-switch>
                        </ha-formfield>
                        <ha-formfield .label=${'Show state'}>
                            <ha-switch
                                .checked=${entity?.show_state === true}
                                @change=${(ev: Event) =>
                                    onPatch({ show_state: (eventTarget(ev) as HTMLInputElement).checked })}
                            ></ha-switch>
                        </ha-formfield>
                        <ha-formfield .label=${'Toggle'}>
                            <ha-switch
                                .checked=${entity?.toggle === true}
                                @change=${(ev: Event) =>
                                    onPatch({ toggle: (eventTarget(ev) as HTMLInputElement).checked })}
                            ></ha-switch>
                        </ha-formfield>
                        <ha-formfield .label=${'Hide when unavailable'}>
                            <ha-switch
                                .checked=${entity?.hide_unavailable === true}
                                @change=${(ev: Event) =>
                                    onPatch({ hide_unavailable: (eventTarget(ev) as HTMLInputElement).checked })}
                            ></ha-switch>
                        </ha-formfield>
                        <ha-formfield .label=${'State color'}>
                            <ha-switch
                                .checked=${entity?.state_color === true}
                                @change=${(ev: Event) =>
                                    onPatch({ state_color: (eventTarget(ev) as HTMLInputElement).checked })}
                            ></ha-switch>
                        </ha-formfield>
                    </div>
                    <div class="row">
                        <ha-textfield
                            .label=${'Attribute'}
                            .value=${entity?.attribute ?? ''}
                            @change=${(ev: Event) => {
                                const value = (eventTarget(ev) as HTMLInputElement).value;
                                onPatch({ attribute: value || undefined });
                            }}
                        ></ha-textfield>
                        <ha-textfield
                            .label=${'Unit'}
                            .value=${entity?.unit ?? ''}
                            @change=${(ev: Event) => {
                                const value = (eventTarget(ev) as HTMLInputElement).value;
                                onPatch({ unit: value || undefined });
                            }}
                        ></ha-textfield>
                        <ha-textfield
                            .label=${'Format'}
                            .value=${entity?.format ?? ''}
                            @change=${(ev: Event) => {
                                const value = (eventTarget(ev) as HTMLInputElement).value;
                                onPatch({ format: value || undefined });
                            }}
                        ></ha-textfield>
                    </div>
                </div>
            </ha-expansion-panel>
        `;
    }

    private _renderRowEditor(row: RoomCardRow | undefined, rowIndex: number): TemplateResult {
        return html`
            <ha-expansion-panel .header=${`Row ${rowIndex + 1}`}>
                <div class="row-editor">
                    <div class="row">
                        <ha-select
                            class="grow"
                            .label=${'Content alignment'}
                            .value=${(row?.content_alignment as string) ?? 'left'}
                            @change=${(ev: Event) =>
                                this._updateRow(rowIndex, {
                                    content_alignment: (eventTarget(ev) as HTMLSelectElement)
                                        .value as RoomCardAlignment,
                                })}
                        >
                            <mwc-list-item value="left">Left</mwc-list-item>
                            <mwc-list-item value="center">Center</mwc-list-item>
                            <mwc-list-item value="right">Right</mwc-list-item>
                        </ha-select>
                        <ha-icon-button .label=${'Delete row'} @click=${() => this._removeRow(rowIndex)}>
                            <ha-icon icon="mdi:delete"></ha-icon>
                        </ha-icon-button>
                    </div>
                    ${(row?.entities ?? []).map((rowEntity, entityIndex) =>
                        this._renderEntityEditor(
                            rowEntity,
                            this._entityHeader(rowEntity, entityIndex),
                            (patch) => this._updateRowEntity(rowIndex, entityIndex, patch),
                            () => this._removeRowEntity(rowIndex, entityIndex),
                        ),
                    )}
                    <ha-button @click=${() => this._addRowEntity(rowIndex)}>Add entity</ha-button>
                </div>
            </ha-expansion-panel>
        `;
    }

    private _entityHeader(entity: RoomCardEntity | undefined, index: number): string {
        if (!entity || !entity.entity) {
            return `Entity ${index + 1}`;
        }
        const stateObj = this.hass.states[entity.entity];
        return stateObj?.attributes.friendly_name || entity.entity;
    }

    private _fire(): void {
        if (!this.hass) {
            return;
        }
        fireEvent(this, 'config-changed', { config: { ...this._config, type: 'custom:modern-room-card' } });
    }

    private _deriveAdvancedYaml(): void {
        const advanced = pick(this._config, ADVANCED_KEYS);
        this._advancedYaml = Object.keys(advanced).length > 0 ? yaml.dump(advanced) : '';
    }

    private _titleChanged(ev: Event): void {
        this._config = { ...this._config, title: (eventTarget(ev) as HTMLInputElement).value || undefined };
        this._fire();
    }

    private _mainEntityChanged(ev: Event): void {
        this._config = {
            ...this._config,
            entity: ((ev as CustomEvent).detail.value as string) || undefined,
        };
        this._fire();
    }

    private _mainIconChanged(ev: Event): void {
        this._config = {
            ...this._config,
            icon: ((ev as CustomEvent).detail.value as string) || undefined,
        };
        this._fire();
    }

    private _hideTitleChanged(ev: Event): void {
        this._config = { ...this._config, hide_title: (eventTarget(ev) as HTMLInputElement).checked };
        this._fire();
    }

    private _alignmentChanged(ev: Event): void {
        this._config = {
            ...this._config,
            content_alignment: (eventTarget(ev) as HTMLSelectElement).value as RoomCardAlignment,
        };
        this._fire();
    }

    private _addEntity(): void {
        this._addEntityList('entities');
    }

    private _addInfoEntity(): void {
        this._addEntityList('info_entities');
    }

    private _addEntityList(listKey: 'entities' | 'info_entities'): void {
        const list = [...(this._config[listKey] ?? [])];
        list.push({} as RoomCardEntity);
        this._config = { ...this._config, [listKey]: list };
        this._fire();
    }

    private _updateEntity(
        listKey: 'entities' | 'info_entities',
        index: number,
        patch: Partial<RoomCardEntity>,
    ): void {
        const list = [...(this._config[listKey] ?? [])];
        list[index] = { ...list[index], ...patch };
        this._config = { ...this._config, [listKey]: list };
        this._fire();
    }

    private _removeEntity(listKey: 'entities' | 'info_entities', index: number): void {
        const list = [...(this._config[listKey] ?? [])];
        list.splice(index, 1);
        this._config = { ...this._config, [listKey]: list };
        this._fire();
    }

    private _addRow(): void {
        const rows = [...(this._config.rows ?? [])];
        rows.push({ entities: [{} as RoomCardEntity] });
        this._config = { ...this._config, rows };
        this._fire();
    }

    private _updateRow(rowIndex: number, patch: Partial<RoomCardRow>): void {
        const rows = [...(this._config.rows ?? [])];
        rows[rowIndex] = { entities: [], ...rows[rowIndex], ...patch };
        this._config = { ...this._config, rows };
        this._fire();
    }

    private _removeRow(rowIndex: number): void {
        const rows = [...(this._config.rows ?? [])];
        rows.splice(rowIndex, 1);
        this._config = { ...this._config, rows };
        this._fire();
    }

    private _addRowEntity(rowIndex: number): void {
        const rows = [...(this._config.rows ?? [])];
        const row = { entities: [], ...rows[rowIndex] };
        const entities = row.entities ? [...row.entities] : [];
        entities.push({} as RoomCardEntity);
        row.entities = entities;
        rows[rowIndex] = row;
        this._config = { ...this._config, rows };
        this._fire();
    }

    private _updateRowEntity(
        rowIndex: number,
        entityIndex: number,
        patch: Partial<RoomCardEntity>,
    ): void {
        const rows = [...(this._config.rows ?? [])];
        const row = { entities: [], ...rows[rowIndex] };
        const entities = row.entities ? [...row.entities] : [];
        entities[entityIndex] = { ...entities[entityIndex], ...patch };
        row.entities = entities;
        rows[rowIndex] = row;
        this._config = { ...this._config, rows };
        this._fire();
    }

    private _removeRowEntity(rowIndex: number, entityIndex: number): void {
        const rows = [...(this._config.rows ?? [])];
        const row = { entities: [], ...rows[rowIndex] };
        if (row.entities) {
            const entities = [...row.entities];
            entities.splice(entityIndex, 1);
            row.entities = entities;
            rows[rowIndex] = row;
        }
        this._config = { ...this._config, rows };
        this._fire();
    }

    private _advancedChanged(ev: Event): void {
        const raw = ((ev as CustomEvent).detail?.value as string) ?? '';
        this._advancedYaml = raw;

        try {
            const parsed = raw.trim().length > 0 ? yaml.load(raw) : {};
            const advanced =
                parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                    ? (parsed as Partial<RoomCardConfig>)
                    : {};

            this._config = {
                ...this._config,
                ...pick(advanced, ADVANCED_KEYS),
                ...pick(this._config, STRUCTURED_KEYS),
            };
            this._advancedError = false;
            this._fire();
        } catch {
            this._advancedError = true;
        }
    }

    private _tapActionFromValue(value: string): ActionConfig | undefined {
        if (!value) {
            return undefined;
        }
        return { action: value } as ActionConfig;
    }
}
