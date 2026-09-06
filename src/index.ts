import { CSSResult, html, LitElement, PropertyValues, TemplateResult } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { HomeAssistant, LovelaceCard, LovelaceCardConfig, LovelaceCardEditor, createThing } from 'custom-card-helpers';

import { checkConfig, entityStyles, renderInfoEntity, renderRows, renderTitle } from './entity';
import { resolveAppearance } from './appearance';
import { getEntityIds, parseConfig } from './util';
import { hideIfCard } from './hide';
import { style } from './styles';
import { HomeAssistantEntity, RoomCardConfig, RoomCardLovelaceCardConfig } from './types';
import './editor';
import packageJson from '../package.json';

console.info(
    `%c MODERN-ROOM-CARD %c ${packageJson.version}`,
    'color: cyan; background: black; font-weight: bold;',
    'color: darkblue; background: white; font-weight: bold;',
);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
    type: 'modern-room-card',
    name: 'Modern Room card',
    preview: false,
    description:
        'A modernized room card for Home Assistant: show multiple entity states, attributes and icons in a single card.',
    documentationURL: 'https://github.com/cybearde/ha_modern-room-card',
});

@customElement('modern-room-card')
export default class ModernRoomCard extends LitElement {
    public static async getConfigElement(): Promise<LovelaceCardEditor> {
        // Match Home Assistant's asynchronous card-editor contract and make
        // registration ordering explicit, even though the editor is bundled.
        await customElements.whenDefined('modern-room-card-editor');
        return document.createElement('modern-room-card-editor') as LovelaceCardEditor;
    }

    public static getStubConfig(): Partial<RoomCardConfig> {
        return {
            title: 'Living Room',
            rows: [{ entities: [] }],
        };
    }

    @property() _helpers!: { createCardElement(config: LovelaceCardConfig): LovelaceCard };

    @property() _hass!: HomeAssistant;

    @property() config!: RoomCardConfig;

    private childCards = new Map<string, LovelaceCard>();
    private helpersPromise?: Promise<void>;
    private helperError?: string;
    private hasTemplates = false;

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        if (!this.config) return false;
        if (!changedProps.has('_hass') || changedProps.size > 1) return true;
        const previous = changedProps.get('_hass') as HomeAssistant | undefined;
        if (!previous || this.hasTemplates) return true;
        return previous.locale !== this._hass.locale || previous.localize !== this._hass.localize ||
            previous.themes !== this._hass.themes || previous.user !== this._hass.user ||
            this.config.entityIds.some((id) => previous.states[id] !== this._hass.states[id]);
    }

    setConfig(config: RoomCardConfig): void {
        checkConfig(config);
        this.config = { ...config, entityIds: getEntityIds(config) };
        // JavaScript templates may read arbitrary entities or hass properties.
        this.hasTemplates = JSON.stringify(config).includes('"template"');
        const keys = new Set(config.cards?.map((card, index) => this.childKey(card, index)));
        for (const key of this.childCards.keys()) if (!keys.has(key)) this.childCards.delete(key);
        if (!this._helpers && !this.helpersPromise && (window as any).loadCardHelpers) {
            this.helpersPromise = Promise.resolve().then(() => (window as any).loadCardHelpers())
                .then((helpers) => { this._helpers = helpers; })
                .catch((error: unknown) => { this.helperError = String(error); })
                .finally(() => { this.requestUpdate(); });
        }
    }

    get hass(): HomeAssistant { return this._hass; }

    set hass(hass: HomeAssistant) {
        this._hass = hass;
        for (const child of this.childCards.values()) child.hass = hass;
    }

    private childKey(config: RoomCardLovelaceCardConfig, index: number): string {
        return `${index}:${JSON.stringify(config)}`;
    }

    static get styles(): CSSResult {
        return style;
    }

    render(): TemplateResult {
        if (!this._hass || !this.config) return html``;

        try {
            const { entity, info_entities, rows, stateObj } = parseConfig(this.config, this._hass);
            const configuredCardStyles = this._resolveCardStyles(stateObj);
            const resolvedAppearance = resolveAppearance(this.config.appearance, this._hass, configuredCardStyles);
            const cardClasses = [
                this.config.layout === 'compact' ? 'compact' : '',
                `content-size-${this.config.content_size ?? 'default'}`,
                `title-${this.config.title_wrap ?? 'auto'}`,
                resolvedAppearance.rule ? 'appearance-active' : '',
                this.config.appearance?.transition === 'subtle' ? 'appearance-subtle' : '',
            ]
                .filter(Boolean)
                .join(' ');
            const sizingStyles: Record<string, string> =
                this.config.title_size !== undefined
                    ? { '--modern-room-card-title-size': `${Math.min(40, Math.max(12, this.config.title_size))}px` }
                    : {};
            const cardStyle = { ...resolvedAppearance.styles, ...sizingStyles, ...configuredCardStyles };

            // Resolve the theme reference in the parent scope before the card aliases HA text variables.
            const foreground = cardStyle['--modern-room-card-conditional-foreground'];
            delete cardStyle['--modern-room-card-conditional-foreground'];
            return html`
                <div style=${styleMap({ display: 'contents', '--modern-room-card-conditional-foreground': foreground })}>
                    <ha-card
                        class=${cardClasses}
                        elevation="2"
                        style=${styleMap(cardStyle)}
                    >
                        <div class="card-header">
                            ${renderTitle(
                                this.config,
                                this._hass,
                                this,
                                entity,
                                info_entities.map((infoEntity) => renderInfoEntity(infoEntity, this._hass, this)),
                            )}
                        </div>
                        ${renderRows(rows, this._hass, this)}
                        ${this.helperError ? html`<hui-warning>${this.helperError}</hui-warning>` : ''}
                        ${this.config.cards?.map((card, index) => this.createCardElement(card, this._hass, index))}
                    </ha-card>
                </div>
            `;
        } catch (error) {
            return html`<hui-warning>${(error as Error).toString()}</hui-warning>`;
        }
    }

    private _resolveCardStyles(stateObj: HomeAssistantEntity | undefined): Record<string, string> {
        const configured = this.config.card_styles;
        if (!configured) return {};
        if (!('template' in configured)) {
            return Object.fromEntries(
                Object.entries(configured).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
            );
        }

        // Template styles historically return a CSS declaration string. Let the browser parse that string so
        // values containing functions, gradients, or custom properties remain intact before using styleMap.
        const styleText = entityStyles(configured, stateObj, this._hass);
        const parser = document.createElement('span');
        parser.style.cssText = styleText;
        const styles: Record<string, string> = {};
        for (const property of Array.from(parser.style)) {
            const value = parser.style.getPropertyValue(property);
            styles[property] = parser.style.getPropertyPriority(property) ? `${value} !important` : value;
        }
        return styles;
    }

    getCardSize(): number {
        const numberOfCards = this.config.cards ? this.config.cards.length : 0;
        const numberOfRows = this.config.rows ? this.config.rows.length : 0;
        const mainSize = !this.config.info_entities && this.config.hide_title ? 1 : 2;

        return (
            numberOfCards +
            numberOfRows +
            mainSize
        );
    }

    createCardElement(config: RoomCardLovelaceCardConfig, hass: HomeAssistant, index = 0): LovelaceCard | undefined {
        const showStates = config.show_states;
        if (
            hideIfCard(config, hass) ||
            (showStates && config.entity && !showStates.includes(hass.states[config.entity]?.state))
        ) {
            return undefined;
        }

        if (this.helpersPromise && !this._helpers) return undefined;
        const key = this.childKey(config, index);
        let element = this.childCards.get(key);
        if (!element) {
            element = this._helpers ? this._helpers.createCardElement(config) : createThing(config);
            if (!element) return undefined;
            this.childCards.set(key, element);
            // HA error placeholders request rebuilding when a lazy custom element becomes available.
            element.addEventListener('ll-rebuild', (ev) => {
                ev.stopPropagation();
                if (this.childCards.get(key) !== element) return;
                this.childCards.delete(key);
                this.requestUpdate();
            });
        }

        element.hass = hass;
        element.style.boxShadow = 'none';
        element.style.borderRadius = '0';

        return element;
    }
}
