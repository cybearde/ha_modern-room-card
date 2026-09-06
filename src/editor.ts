import { css, CSSResult, html, LitElement, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { fireEvent, HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import * as yaml from 'js-yaml';
import {
    ActionConfig,
    RoomCardAlignment,
    RoomCardAppearanceRule,
    RoomCardConditionOperator,
    RoomCardConfig,
    RoomCardEntity,
    RoomCardEntityConfig,
    RoomCardRow,
} from './types';
import { validateAppearanceConfig } from './appearance';

export const normalizeEntityConfig = (entity: RoomCardEntityConfig | undefined): RoomCardEntity =>
    (typeof entity === 'string' ? { entity } : entity ?? {}) as RoomCardEntity;

export const editorConfigToYaml = (config: Partial<RoomCardConfig>): string => {
    const { entityIds: _entityIds, hass: _hass, ...serializable } = config;
    return yaml.dump(serializable, { noRefs: true, lineWidth: 120 });
};

export const editorConfigFromYaml = (raw: string): Partial<RoomCardConfig> => {
    const parsed = raw.trim().length > 0 ? yaml.load(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('The card configuration must be a YAML object.');
    }

    const config = parsed as Partial<RoomCardConfig>;
    if (config.type !== undefined && config.type !== 'custom:modern-room-card') {
        throw new Error("The type must be 'custom:modern-room-card'.");
    }
    if ('entities' in config) {
        throw new Error('Top-level entities are no longer supported; place them inside rows.');
    }
    if ('content_alignment' in config) {
        throw new Error('Top-level content_alignment is no longer supported; set it on each row.');
    }
    for (const key of ['info_entities', 'rows', 'cards', 'templates'] as const) {
        if (config[key] !== undefined && !Array.isArray(config[key])) {
            throw new Error(`${key} must be a list.`);
        }
    }
    if (config.layout !== undefined && !['default', 'compact'].includes(config.layout)) {
        throw new Error("layout must be 'default' or 'compact'.");
    }
    if (config.content_size !== undefined && !['small', 'default', 'large'].includes(config.content_size)) {
        throw new Error("content_size must be 'small', 'default', or 'large'.");
    }
    if (config.title_wrap !== undefined && !['auto', 'wrap', 'ellipsis'].includes(config.title_wrap)) {
        throw new Error("title_wrap must be 'auto', 'wrap', or 'ellipsis'.");
    }
    if (
        config.title_size !== undefined &&
        (typeof config.title_size !== 'number' || config.title_size < 12 || config.title_size > 40)
    ) {
        throw new Error('title_size must be a number between 12 and 40.');
    }
    validateAppearanceConfig(config.appearance);
    return { ...config, type: 'custom:modern-room-card' };
};

const eventTarget = (ev: Event): any => ev.currentTarget;

interface SelectOption {
    value: string;
    label: string;
}

const ALIGNMENT_OPTIONS: SelectOption[] = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
];

const LAYOUT_OPTIONS: SelectOption[] = [
    { value: 'default', label: 'Default' },
    { value: 'compact', label: 'Compact' },
];

const CONTENT_SIZE_OPTIONS: SelectOption[] = [
    { value: 'small', label: 'Small' },
    { value: 'default', label: 'Default' },
    { value: 'large', label: 'Large' },
];

const TITLE_WRAP_OPTIONS: SelectOption[] = [
    { value: 'auto', label: 'Automatic' },
    { value: 'wrap', label: 'Wrap long words' },
    { value: 'ellipsis', label: 'Single line with ellipsis' },
];

const APPEARANCE_TRANSITION_OPTIONS: SelectOption[] = [
    { value: 'none', label: 'None' },
    { value: 'subtle', label: 'Subtle' },
];

const CONDITION_OPTIONS: SelectOption[] = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'above', label: 'Above' },
    { value: 'below', label: 'Below' },
];

const ACTION_OPTIONS: SelectOption[] = [
    { value: '', label: 'Default' },
    { value: 'none', label: 'None' },
    { value: 'toggle', label: 'Toggle' },
    { value: 'more-info', label: 'Show more-info' },
    { value: 'navigate', label: 'Navigate' },
    { value: 'url', label: 'Open URL' },
    { value: 'perform-action', label: 'Perform action' },
    { value: 'assist', label: 'Assist' },
];

const selectedValue = (ev: Event): string =>
    String((ev as CustomEvent<{ value?: string }>).detail?.value ?? (eventTarget(ev) as HTMLSelectElement).value ?? '');

const cloneConfig = <T>(value: T): T => {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
};

@customElement('modern-room-card-editor')
export class ModernRoomCardEditor extends LitElement implements LovelaceCardEditor {
    @property() public hass!: HomeAssistant;

    @state() private _config!: Partial<RoomCardConfig>;

    @state() private _advancedYaml = '';

    @state() private _advancedError = false;

    public setConfig(config: RoomCardConfig): void {
        // Home Assistant can reuse editor instances while moving between cards.
        // Keep our editable state detached from the dashboard's source objects.
        const incoming = cloneConfig(config);
        this._config = {
            info_entities: [],
            rows: [],
            ...incoming,
            type: 'custom:modern-room-card',
        };
        this._advancedError = false;
        this._deriveAdvancedYaml();
    }

    static get styles(): CSSResult {
        return css`
            .card-config {
                display: flex;
                flex-direction: column;
                gap: 16px;
                box-sizing: border-box;
                max-width: 100%;
                min-width: 0;
                padding-bottom: max(80px, env(safe-area-inset-bottom));
                width: 100%;
            }
            .config-section {
                --section-accent: var(--primary-color);
                background: var(--card-background-color, var(--ha-card-background));
                border: 1px solid var(--divider-color);
                border-top: 4px solid var(--section-accent);
                border-radius: var(--ha-border-radius-lg, 12px);
                box-shadow: var(--ha-card-box-shadow, 0 1px 2px rgba(0, 0, 0, 0.08));
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-width: 100%;
                min-width: 0;
                padding: 12px;
                width: 100%;
            }
            .main-config-section {
                --section-accent: var(--primary-color);
            }
            .appearance-section {
                --section-accent: var(--warning-color, #ff9800);
            }
            .info-entities-section {
                --section-accent: var(--info-color, #039be5);
            }
            .rows-section {
                --section-accent: var(--success-color, #43a047);
            }
            .section-heading,
            .section-header {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                justify-content: space-between;
                gap: 12px;
            }
            .section-heading-copy {
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
            }
            .section-title {
                color: var(--primary-text-color);
                font-size: 16px;
                font-weight: 600;
                line-height: 22px;
            }
            .section-description {
                color: var(--secondary-text-color);
                font-size: 12px;
                font-weight: 400;
                line-height: 16px;
                overflow-wrap: anywhere;
            }
            .row {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
                gap: 8px;
                align-items: center;
                box-sizing: border-box;
                max-width: 100%;
                min-width: 0;
                padding: 4px 0;
                width: 100%;
            }
            .row > *,
            .appearance-color-grid > *,
            .section-actions > * {
                box-sizing: border-box;
                max-width: 100%;
                min-width: 0;
            }
            .grow {
                flex: 1;
            }
            ha-select,
            ha-input,
            ha-entity-picker,
            ha-icon-picker,
            ha-slider,
            ha-code-editor {
                box-sizing: border-box;
                max-width: 100%;
                min-width: 0;
                width: 100%;
            }
            .main-picker {
                flex: 1 1 0;
                min-width: 0;
            }
            .main-title-field {
                display: block;
                width: 100%;
            }
            .main-picker-field {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .main-picker-label {
                color: var(--secondary-text-color);
                font-size: 12px;
                line-height: 16px;
                padding-inline: 12px;
            }
            .main-picker-group {
                align-items: stretch;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                padding: 0;
            }
            .title-size-control {
                display: flex;
                flex: 1;
                flex-direction: column;
                gap: 2px;
                min-width: 160px;
                padding: 0 12px;
            }
            .title-size-header {
                color: var(--secondary-text-color);
                display: flex;
                font-size: 12px;
                justify-content: space-between;
                line-height: 16px;
            }
            .title-size-value {
                color: var(--primary-text-color);
                font-variant-numeric: tabular-nums;
                font-weight: 500;
            }
            .section {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .section-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                max-width: 100%;
                min-width: 0;
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
                border: 1px solid var(--divider-color);
                border-radius: var(--ha-border-radius-md, 8px);
                box-sizing: border-box;
                max-width: 100%;
                min-width: 0;
                overflow: hidden;
                width: 100%;
            }
            .config-section > ha-expansion-panel + ha-expansion-panel {
                margin-top: 4px;
            }
            .row-editor > ha-expansion-panel {
                border-inline-start: 3px solid var(--section-accent, var(--primary-color));
                margin-block: 4px;
                margin-inline-start: 8px;
            }
            .appearance-rule-editor {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 8px 0;
            }
            .appearance-rule-actions {
                align-items: center;
                display: flex;
                flex-wrap: wrap;
                gap: 2px;
            }
            .appearance-color-grid {
                display: grid;
                gap: 8px;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                padding: 4px 0;
            }
            .appearance-help,
            .appearance-rule-error {
                color: var(--secondary-text-color);
                font-size: 12px;
                line-height: 16px;
                margin: 0;
            }
            .appearance-rule-error {
                color: var(--error-color);
            }
            .appearance-opacity {
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
                padding: 0 12px;
            }
            .appearance-opacity-header {
                color: var(--secondary-text-color);
                display: flex;
                font-size: 12px;
                justify-content: space-between;
                line-height: 16px;
            }
            @media (max-width: 600px) {
                .row {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .row > :only-child,
                .appearance-opacity {
                    grid-column: 1 / -1;
                }
                .appearance-color-grid {
                    grid-template-columns: 1fr;
                }
                .config-section {
                    padding: 10px;
                }
                .row-editor > ha-expansion-panel {
                    margin-inline-start: 4px;
                }
            }
            @media (max-width: 400px) {
                .row,
                .main-picker-group {
                    grid-template-columns: minmax(0, 1fr);
                }
                .action-controls > *,
                .appearance-condition-controls > * {
                    grid-column: 1 / -1;
                }
                .title-size-control {
                    min-width: 0;
                }
            }
            .advanced-section {
                margin-top: 0;
                max-width: 100%;
                min-width: 0;
            }
            .advanced-section p {
                overflow-wrap: anywhere;
            }
        `;
    }

    protected render(): TemplateResult {
        if (!this.hass || !this._config) return html``;

        return html`
            <div class="card-config">
                <div class="config-section main-config-section">
                    <div class="section-heading">
                        <div class="section-heading-copy">
                            <span class="section-title">Main entity</span>
                            <span class="section-description">Card header, appearance, and actions</span>
                        </div>
                    </div>
                    <div class="main-picker-field">
                        <div class="main-picker-label">Main entity and icon (optional)</div>
                        <div class="row main-picker-group">
                            ${keyed(
                                typeof this._config.entity === 'string' ? this._config.entity : '',
                                html`<ha-entity-picker
                                    class="main-picker"
                                    .hass=${this.hass}
                                    aria-label="Main entity"
                                    allow-custom-entity
                                    .value=${typeof this._config.entity === 'string' ? this._config.entity : ''}
                                    @value-changed=${this._mainEntityChanged}
                                ></ha-entity-picker>`,
                            )}
                            ${keyed(
                                typeof this._config.icon === 'string' ? this._config.icon : '',
                                html`<ha-icon-picker
                                    class="main-picker"
                                    .hass=${this.hass}
                                    aria-label="Main icon"
                                    .value=${typeof this._config.icon === 'string' ? this._config.icon : ''}
                                    @value-changed=${this._mainIconChanged}
                                ></ha-icon-picker>`,
                            )}
                        </div>
                        <ha-input
                            class="main-title-field"
                            .label=${'Title'}
                            .value=${typeof this._config.title === 'string' ? this._config.title : ''}
                            @change=${this._mainTitleChanged}
                        ></ha-input>
                    </div>

                    <div class="options">
                        <ha-formfield .label=${'Hide title'}>
                            <ha-switch
                                .checked=${this._config.hide_title === true}
                                @change=${this._hideTitleChanged}
                            ></ha-switch>
                        </ha-formfield>
                        <ha-formfield .label=${'Show main icon'}>
                            <ha-switch
                                .checked=${this._config.show_icon === true}
                                @change=${this._mainShowIconChanged}
                            ></ha-switch>
                        </ha-formfield>
                        <ha-formfield .label=${'Color main icon by state'}>
                            <ha-switch
                                class="main-state-color"
                                .checked=${this._config.state_color !== false}
                                @change=${this._mainStateColorChanged}
                            ></ha-switch>
                        </ha-formfield>
                    </div>
                    <div class="row">
                        <ha-select
                            class="grow layout-select"
                            .label=${'Layout'}
                            .value=${this._config.layout ?? 'default'}
                            .options=${LAYOUT_OPTIONS}
                            @selected=${this._layoutChanged}
                        ></ha-select>
                        <div class="title-size-control">
                            <div class="title-size-header">
                                <span>Title size</span>
                                <span class="title-size-value">${this._config.title_size ?? 18}px</span>
                            </div>
                            <ha-slider
                                aria-label="Title size"
                                labeled
                                .min=${12}
                                .max=${40}
                                .step=${1}
                                .value=${this._config.title_size ?? 18}
                                @change=${this._titleSizeChanged}
                            ></ha-slider>
                        </div>
                    </div>

                    <div class="row">
                        <ha-select
                            class="grow content-size-select"
                            .label=${'Content size'}
                            .value=${this._config.content_size ?? 'default'}
                            .options=${CONTENT_SIZE_OPTIONS}
                            @selected=${this._contentSizeChanged}
                        ></ha-select>
                        <ha-select
                            class="grow title-wrap-select"
                            .label=${'Title overflow'}
                            .value=${this._config.title_wrap ?? 'auto'}
                            .options=${TITLE_WRAP_OPTIONS}
                            @selected=${this._titleWrapChanged}
                        ></ha-select>
                    </div>

                    <div class="row action-controls">
                        ${this._renderActionSelect('Tap action', this._config.tap_action, (tap_action) =>
                            this._updateConfig({ tap_action }),
                        )}
                        ${this._renderActionSelect('Hold action', this._config.hold_action, (hold_action) =>
                            this._updateConfig({ hold_action }),
                        )}
                        ${this._renderActionSelect(
                            'Double-tap action',
                            this._config.double_tap_action,
                            (double_tap_action) => this._updateConfig({ double_tap_action }),
                        )}
                    </div>
                </div>

                <div class="section config-section info-entities-section">
                    <div class="section-header">
                        <div class="section-heading-copy">
                            <span class="section-title">Info entities</span>
                            <span class="section-description">Compact values displayed in the top-right header</span>
                        </div>
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

                <div class="section config-section rows-section">
                    <div class="section-header">
                        <div class="section-heading-copy">
                            <span class="section-title">Rows</span>
                            <span class="section-description">Arrange normal entities, alignment, and empty slots</span>
                        </div>
                        <ha-button @click=${this._addRow}>Add row</ha-button>
                    </div>
                    ${(this._config.rows ?? []).map((row, rowIndex) => this._renderRowEditor(row, rowIndex))}
                </div>

                <div class="section config-section appearance-section">
                    <div class="section-header">
                        <div class="section-heading-copy">
                            <span class="section-title">Appearance</span>
                            <span class="section-description">Conditional card background, accent, and foreground</span>
                        </div>
                        <ha-button @click=${this._addAppearanceRule}>Add rule</ha-button>
                    </div>
                    <p class="appearance-help">
                        The highest-priority matching rule controls the card. Equal priorities use the first rule.
                    </p>
                    <div class="row">
                        <ha-select
                            class="grow appearance-transition"
                            .label=${'Transition'}
                            .value=${this._config.appearance?.transition ?? 'none'}
                            .options=${APPEARANCE_TRANSITION_OPTIONS}
                            @selected=${this._appearanceTransitionChanged}
                        ></ha-select>
                    </div>
                    ${(this._config.appearance?.states ?? []).map((rule, index, rules) =>
                        this._renderAppearanceRule(rule, index, rules.length),
                    )}
                </div>

                <div class="section advanced-section">
                    <ha-expansion-panel .header=${'Full configuration (YAML)'}>
                        <ha-code-editor
                            mode="yaml"
                            .error=${this._advancedError}
                            .value=${this._advancedYaml}
                            @value-changed=${this._advancedChanged}
                        ></ha-code-editor>
                        <p>Invalid YAML stays local and is not applied to the card.</p>
                    </ha-expansion-panel>
                </div>
            </div>
        `;
    }

    private _renderActionSelect(
        label: string,
        action: ActionConfig | undefined,
        onChange: (action: ActionConfig | undefined) => void,
    ): TemplateResult {
        return html`<ha-select
            class="grow"
            .label=${label}
            .value=${action?.action ?? ''}
            .options=${ACTION_OPTIONS}
            @selected=${(ev: Event) => onChange(this._tapActionFromValue(selectedValue(ev)))}
        ></ha-select>`;
    }

    private _renderAppearanceRule(rule: RoomCardAppearanceRule, index: number, ruleCount: number): TemplateResult {
        const errors = this._appearanceRuleErrors(rule);
        const header = rule.entity ? `${rule.entity} · priority ${rule.priority ?? 0}` : `Appearance rule ${index + 1}`;
        return html`
            <ha-expansion-panel class="appearance-rule" .header=${header}>
                <div class="appearance-rule-editor">
                    <div class="row">
                        ${keyed(
                            `${index}:${rule.entity ?? ''}`,
                            html`<ha-entity-picker
                                class="grow"
                                .hass=${this.hass}
                                .label=${'Condition entity'}
                                allow-custom-entity
                                .value=${rule.entity ?? ''}
                                @value-changed=${(ev: Event) =>
                                    this._updateAppearanceRule(index, {
                                        entity: ((ev as CustomEvent).detail.value as string) || undefined,
                                    })}
                            ></ha-entity-picker>`,
                        )}
                        <ha-input
                            class="grow"
                            .label=${'Attribute (optional)'}
                            .value=${rule.attribute ?? ''}
                            @change=${(ev: Event) =>
                                this._updateAppearanceRule(index, {
                                    attribute: this._optionalInputValue(ev),
                                })}
                        ></ha-input>
                    </div>
                    <div class="row appearance-condition-controls">
                        <ha-select
                            class="grow appearance-condition"
                            .label=${'Condition'}
                            .value=${rule.condition ?? ''}
                            .options=${CONDITION_OPTIONS}
                            @selected=${(ev: Event) =>
                                this._updateAppearanceRule(index, {
                                    condition: selectedValue(ev) as RoomCardConditionOperator,
                                })}
                        ></ha-select>
                        <ha-input
                            class="grow appearance-value"
                            .label=${'Comparison value'}
                            .value=${rule.value === undefined ? '' : String(rule.value)}
                            @change=${(ev: Event) =>
                                this._updateAppearanceRule(index, { value: this._optionalInputValue(ev) })}
                        ></ha-input>
                        <ha-input
                            class="grow appearance-priority"
                            .label=${'Priority'}
                            .type=${'number'}
                            .value=${rule.priority === undefined ? '' : String(rule.priority)}
                            @change=${(ev: Event) => this._appearancePriorityChanged(index, ev)}
                        ></ha-input>
                    </div>
                    <div class="appearance-color-grid">
                        ${this._renderAppearanceColorInput('Background', rule.background, (background) =>
                            this._updateAppearanceRule(index, { background }),
                        )}
                        ${this._renderAppearanceColorInput('Accent', rule.accent, (accent) =>
                            this._updateAppearanceRule(index, { accent }),
                        )}
                        ${this._renderAppearanceColorInput('Foreground', rule.foreground, (foreground) =>
                            this._updateAppearanceRule(index, { foreground }),
                        )}
                    </div>
                    <div class="row">
                        <div class="appearance-opacity">
                            <div class="appearance-opacity-header">
                                <span>Background opacity</span>
                                <span>${rule.opacity === undefined ? 'Default' : rule.opacity.toFixed(2)}</span>
                            </div>
                            <ha-slider
                                aria-label="Background opacity"
                                .min=${0}
                                .max=${1}
                                .step=${0.05}
                                .value=${rule.opacity ?? (rule.background === 'entity-color' ? 0.12 : 1)}
                                @change=${(ev: Event) => this._appearanceOpacityChanged(index, ev)}
                            ></ha-slider>
                        </div>
                        ${rule.opacity !== undefined
                            ? html`<ha-button @click=${() => this._updateAppearanceRule(index, { opacity: undefined })}
                                  >Use default</ha-button
                              >`
                            : ''}
                    </div>
                    ${errors.length
                        ? html`<p class="appearance-rule-error">${errors.join(' ')}</p>`
                        : html`<p class="appearance-help">
                              Colors accept CSS values, gradients, theme variables, and entity-color.
                          </p>`}
                    <div class="appearance-rule-actions">
                        <ha-icon-button
                            .label=${'Move rule up'}
                            .disabled=${index === 0}
                            @click=${() => this._moveAppearanceRule(index, -1)}
                        >
                            <ha-icon icon="mdi:arrow-up"></ha-icon>
                        </ha-icon-button>
                        <ha-icon-button
                            .label=${'Move rule down'}
                            .disabled=${index === ruleCount - 1}
                            @click=${() => this._moveAppearanceRule(index, 1)}
                        >
                            <ha-icon icon="mdi:arrow-down"></ha-icon>
                        </ha-icon-button>
                        <ha-button @click=${() => this._removeAppearanceRule(index)}>Remove rule</ha-button>
                    </div>
                </div>
            </ha-expansion-panel>
        `;
    }

    private _renderAppearanceColorInput(
        label: string,
        value: string | undefined,
        onChange: (value: string | undefined) => void,
    ): TemplateResult {
        return html`<ha-input
            .label=${label}
            .value=${value ?? ''}
            @change=${(ev: Event) => onChange(this._optionalInputValue(ev))}
        ></ha-input>`;
    }

    private _renderEntityEditor(
        entityConfig: RoomCardEntityConfig | undefined,
        header: string,
        onPatch: (patch: Partial<RoomCardEntity>) => void,
        onRemove: () => void,
    ): TemplateResult {
        const entity = normalizeEntityConfig(entityConfig);
        return html`
            <ha-expansion-panel .header=${header}>
                <div class="entity-editor">
                    <div class="row">
                        ${keyed(
                            entity.entity ?? '',
                            html`<ha-entity-picker
                                class="grow"
                                .hass=${this.hass}
                                allow-custom-entity
                                .value=${entity.entity ?? ''}
                                @value-changed=${(ev: Event) =>
                                    onPatch({ entity: ((ev as CustomEvent).detail.value as string) ?? '' })}
                            ></ha-entity-picker>`,
                        )}
                        <ha-icon-button .label=${'Delete'} @click=${onRemove}>
                            <ha-icon icon="mdi:delete"></ha-icon>
                        </ha-icon-button>
                    </div>
                    ${!entity.entity && !entity.template
                        ? html`<div class="row">
                              <ha-input
                                  class="grow"
                                  .label=${'Empty slot width (for example 10px)'}
                                  .value=${entity.width?.toString() ?? ''}
                                  @change=${(ev: Event) => {
                                      const value = (eventTarget(ev) as HTMLInputElement).value.trim();
                                      onPatch({ width: value || undefined });
                                  }}
                              ></ha-input>
                          </div>`
                        : ''}
                    <div class="row">
                        <ha-input
                            class="grow entity-name-input"
                            .label=${'Entity name (optional)'}
                            .value=${(entity?.name as string) ?? ''}
                            @change=${(ev: Event) =>
                                onPatch({ name: (eventTarget(ev) as HTMLInputElement).value })}
                        ></ha-input>
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
                    <div class="row action-controls">
                        ${this._renderActionSelect('Tap action', entity.tap_action, (tap_action) =>
                            onPatch({ tap_action }),
                        )}
                        ${this._renderActionSelect('Hold action', entity.hold_action, (hold_action) =>
                            onPatch({ hold_action }),
                        )}
                        ${this._renderActionSelect('Double-tap action', entity.double_tap_action, (double_tap_action) =>
                            onPatch({ double_tap_action }),
                        )}
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
                        <ha-input
                            .label=${'Attribute'}
                            .value=${entity?.attribute ?? ''}
                            @change=${(ev: Event) => {
                                const value = (eventTarget(ev) as HTMLInputElement).value;
                                onPatch({ attribute: value || undefined });
                            }}
                        ></ha-input>
                        <ha-input
                            .label=${'Unit'}
                            .value=${entity?.unit ?? ''}
                            @change=${(ev: Event) => {
                                const value = (eventTarget(ev) as HTMLInputElement).value;
                                onPatch({ unit: value || undefined });
                            }}
                        ></ha-input>
                        <ha-input
                            .label=${'Format'}
                            .value=${entity?.format ?? ''}
                            @change=${(ev: Event) => {
                                const value = (eventTarget(ev) as HTMLInputElement).value;
                                onPatch({ format: value || undefined });
                            }}
                        ></ha-input>
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
                            .options=${ALIGNMENT_OPTIONS}
                            @selected=${(ev: Event) =>
                                this._updateRow(rowIndex, {
                                    content_alignment: selectedValue(ev) as RoomCardAlignment,
                                })}
                        ></ha-select>
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
                    <div class="section-actions">
                        <ha-button @click=${() => this._addRowEntity(rowIndex)}>Add entity</ha-button>
                        <ha-button @click=${() => this._addRowEmptySlot(rowIndex)}>Add empty slot</ha-button>
                    </div>
                </div>
            </ha-expansion-panel>
        `;
    }

    private _entityHeader(entityConfig: RoomCardEntityConfig | undefined, index: number): string {
        const entity = normalizeEntityConfig(entityConfig);
        if (!entity.entity) {
            return `Empty slot ${index + 1}`;
        }
        if (typeof entity.name === 'string' && entity.name.trim()) {
            return entity.name;
        }
        const stateObj = this.hass.states[entity.entity];
        return stateObj?.attributes.friendly_name || entity.entity;
    }

    private _fire(): void {
        fireEvent(this, 'config-changed', {
            config: cloneConfig({ ...this._config, type: 'custom:modern-room-card' }),
        });
    }

    private _deriveAdvancedYaml(): void {
        this._advancedYaml = editorConfigToYaml(this._config);
    }

    private _updateConfig(patch: Partial<RoomCardConfig>): void {
        this._config = Object.fromEntries(
            Object.entries({ ...this._config, ...patch, type: 'custom:modern-room-card' }).filter(
                ([, value]) => value !== undefined,
            ),
        ) as Partial<RoomCardConfig>;
        this._advancedError = false;
        this._deriveAdvancedYaml();
        this._fire();
    }

    private _mainTitleChanged(ev: Event): void {
        this._updateConfig({ title: (eventTarget(ev) as HTMLInputElement).value || undefined });
    }

    private _mainEntityChanged(ev: Event): void {
        this._updateConfig({
            entity: ((ev as CustomEvent).detail.value as string) || undefined,
        });
    }

    private _mainIconChanged(ev: Event): void {
        this._updateConfig({
            icon: ((ev as CustomEvent).detail.value as string) || undefined,
        });
    }

    private _hideTitleChanged(ev: Event): void {
        this._updateConfig({ hide_title: (eventTarget(ev) as HTMLInputElement).checked });
    }

    private _mainShowIconChanged(ev: Event): void {
        this._updateConfig({ show_icon: (eventTarget(ev) as HTMLInputElement).checked });
    }

    private _mainStateColorChanged(ev: Event): void {
        this._updateConfig({ state_color: (eventTarget(ev) as HTMLInputElement).checked ? undefined : false });
    }

    private _layoutChanged(ev: Event): void {
        const value = selectedValue(ev);
        this._updateConfig({ layout: value === 'compact' ? 'compact' : undefined });
    }

    private _titleSizeChanged(ev: Event): void {
        const raw = String((eventTarget(ev) as HTMLInputElement).value ?? '').trim();
        if (!raw) {
            this._updateConfig({ title_size: undefined });
            return;
        }
        const value = Math.min(40, Math.max(12, Number(raw)));
        this._updateConfig({ title_size: Number.isFinite(value) ? value : undefined });
    }

    private _contentSizeChanged(ev: Event): void {
        const value = selectedValue(ev);
        this._updateConfig({ content_size: value === 'default' ? undefined : (value as 'small' | 'large') });
    }

    private _titleWrapChanged(ev: Event): void {
        const value = selectedValue(ev);
        this._updateConfig({ title_wrap: value === 'auto' ? undefined : (value as 'wrap' | 'ellipsis') });
    }

    private _optionalInputValue(ev: Event): string | undefined {
        const value = String((eventTarget(ev) as HTMLInputElement).value ?? '').trim();
        return value || undefined;
    }

    private _appearanceRuleErrors(rule: RoomCardAppearanceRule): string[] {
        const errors: string[] = [];
        if (!rule.entity) errors.push('Choose an entity.');
        if (!rule.condition) errors.push('Choose a condition.');
        if (rule.value === undefined || rule.value === '') errors.push('Enter a comparison value.');
        if (rule.priority !== undefined && !Number.isFinite(rule.priority)) errors.push('Priority must be numeric.');
        if (rule.opacity !== undefined && (rule.opacity < 0 || rule.opacity > 1)) {
            errors.push('Opacity must be between 0 and 1.');
        }
        return errors;
    }

    private _appearanceTransitionChanged(ev: Event): void {
        const transition = selectedValue(ev) === 'subtle' ? 'subtle' : 'none';
        this._updateConfig({ appearance: { ...this._config.appearance, transition } });
    }

    private _addAppearanceRule(): void {
        const states = [...(this._config.appearance?.states ?? []), {}];
        this._updateConfig({ appearance: { ...this._config.appearance, states } });
    }

    private _updateAppearanceRule(index: number, patch: Partial<RoomCardAppearanceRule>): void {
        const states = [...(this._config.appearance?.states ?? [])];
        const updated = { ...states[index], ...patch };
        states[index] = Object.fromEntries(
            Object.entries(updated).filter(([, value]) => value !== undefined && value !== ''),
        ) as RoomCardAppearanceRule;
        this._updateConfig({ appearance: { ...this._config.appearance, states } });
    }

    private _removeAppearanceRule(index: number): void {
        const states = [...(this._config.appearance?.states ?? [])];
        states.splice(index, 1);
        this._updateConfig({ appearance: { ...this._config.appearance, states } });
    }

    private _moveAppearanceRule(index: number, direction: -1 | 1): void {
        const target = index + direction;
        const states = [...(this._config.appearance?.states ?? [])];
        if (target < 0 || target >= states.length) return;
        [states[index], states[target]] = [states[target], states[index]];
        this._updateConfig({ appearance: { ...this._config.appearance, states } });
    }

    private _appearancePriorityChanged(index: number, ev: Event): void {
        const raw = this._optionalInputValue(ev);
        const value = raw === undefined ? undefined : Number(raw);
        this._updateAppearanceRule(index, { priority: value !== undefined && Number.isFinite(value) ? value : undefined });
    }

    private _appearanceOpacityChanged(index: number, ev: Event): void {
        const value = Number((eventTarget(ev) as HTMLInputElement).value);
        if (!Number.isFinite(value)) return;
        this._updateAppearanceRule(index, { opacity: Math.max(0, Math.min(1, value)) });
    }

    private _addInfoEntity(): void {
        const list = [...(this._config.info_entities ?? [])];
        list.push({} as RoomCardEntity);
        this._updateConfig({ info_entities: list });
    }

    private _updateEntity(
        listKey: 'info_entities',
        index: number,
        patch: Partial<RoomCardEntity>,
    ): void {
        const list = [...(this._config[listKey] ?? [])];
        list[index] = { ...normalizeEntityConfig(list[index]), ...patch };
        this._updateConfig({ [listKey]: list });
    }

    private _removeEntity(listKey: 'info_entities', index: number): void {
        const list = [...(this._config[listKey] ?? [])];
        list.splice(index, 1);
        this._updateConfig({ [listKey]: list });
    }

    private _addRow(): void {
        const rows = [...(this._config.rows ?? [])];
        rows.push({ entities: [{} as RoomCardEntity] });
        this._updateConfig({ rows });
    }

    private _updateRow(rowIndex: number, patch: Partial<RoomCardRow>): void {
        const rows = [...(this._config.rows ?? [])];
        rows[rowIndex] = { entities: [], ...rows[rowIndex], ...patch };
        this._updateConfig({ rows });
    }

    private _removeRow(rowIndex: number): void {
        const rows = [...(this._config.rows ?? [])];
        rows.splice(rowIndex, 1);
        this._updateConfig({ rows });
    }

    private _addRowEntity(rowIndex: number): void {
        const rows = [...(this._config.rows ?? [])];
        const row = { entities: [], ...rows[rowIndex] };
        const entities = row.entities ? [...row.entities] : [];
        entities.push({} as RoomCardEntity);
        row.entities = entities;
        rows[rowIndex] = row;
        this._updateConfig({ rows });
    }

    private _addRowEmptySlot(rowIndex: number): void {
        const rows = [...(this._config.rows ?? [])];
        const row = { entities: [], ...rows[rowIndex] };
        row.entities = [...(row.entities ?? []), {} as RoomCardEntity];
        rows[rowIndex] = row;
        this._updateConfig({ rows });
    }

    private _updateRowEntity(
        rowIndex: number,
        entityIndex: number,
        patch: Partial<RoomCardEntity>,
    ): void {
        const rows = [...(this._config.rows ?? [])];
        const row = { entities: [], ...rows[rowIndex] };
        const entities = row.entities ? [...row.entities] : [];
        entities[entityIndex] = { ...normalizeEntityConfig(entities[entityIndex]), ...patch };
        row.entities = entities;
        rows[rowIndex] = row;
        this._updateConfig({ rows });
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
        this._updateConfig({ rows });
    }

    private _advancedChanged(ev: Event): void {
        const raw = ((ev as CustomEvent).detail?.value as string) ?? '';
        this._advancedYaml = raw;

        try {
            this._config = editorConfigFromYaml(raw);
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
