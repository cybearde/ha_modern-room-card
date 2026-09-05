import { CSSResult, html, LitElement, PropertyValues, TemplateResult } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCard, LovelaceCardConfig, createThing } from 'custom-card-helpers';
import { HassEntities } from 'home-assistant-js-websocket';

import { checkConfig, entityStyles, renderEntitiesRow, renderInfoEntity, renderRows, renderTitle } from './entity';
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
});

@customElement('modern-room-card')
export default class ModernRoomCard extends LitElement {
    public static getStubConfig(): RoomCardConfig {
        return {
            type: 'custom:modern-room-card',
            title: 'Living Room',
            entities: [{ entity: '' }],
        } as unknown as RoomCardConfig;
    }

    @property() monitoredStates: HassEntities = {};

    @property() _helpers!: { createCardElement(config: LovelaceCardConfig): LovelaceCard };

    @property() _hass!: HomeAssistant;

    @property() config!: RoomCardConfig;

    private stateObj: HomeAssistantEntity | undefined;

    getChildCustomCardTypes(cards: RoomCardLovelaceCardConfig[] | undefined, target: Set<string>): void {
        if (!cards) return;

        for (const card of cards) {
            if (card.type.indexOf('custom:') === 0) {
                target.add(card.type.substring(7, card.type.length));
            }
            this.getChildCustomCardTypes(card.cards, target);
        }
    }

    async waitForDependentComponents(config: RoomCardConfig): Promise<void> {
        const distinctTypes = new Set<string>();
        this.getChildCustomCardTypes(config.cards, distinctTypes);
        await Promise.all(Array.from(distinctTypes).map((type) => customElements.whenDefined(type)));
    }

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        return this.monitoredStates !== undefined && this.config !== undefined && changedProps.size > 0;
    }

    updateMonitoredStates(hass: HomeAssistant): void {
        const newStates = { ...this.monitoredStates };
        let anyUpdates = false;

        for (const entityId of this.config.entityIds) {
            if (entityId in hass.states) {
                const monitoredEntity = this.monitoredStates && this.monitoredStates[entityId];

                if (
                    !this.monitoredStates ||
                    (monitoredEntity?.last_updated ?? '') < hass.states[entityId].last_updated ||
                    (monitoredEntity?.last_changed ?? '') < hass.states[entityId].last_changed
                ) {
                    anyUpdates = hass.states[entityId] !== newStates[entityId] || anyUpdates;
                    newStates[entityId] = hass.states[entityId];
                }
            } else if (this.monitoredStates && entityId in this.monitoredStates) {
                anyUpdates = true;
                delete newStates[entityId];
            }
        }

        if (anyUpdates) {
            this.monitoredStates = newStates;
        }
    }

    async setConfig(config: RoomCardConfig): Promise<void> {
        checkConfig(config);

        this.config = { ...config, entityIds: getEntityIds(config) };

        await this.waitForDependentComponents(config);

        if ((window as any).loadCardHelpers) {
            this._helpers = await (window as any).loadCardHelpers();
            this.requestUpdate();
        }
    }

    set hass(hass: HomeAssistant) {
        this._hass = hass;

        if (hass && this.config) {
            this.updateMonitoredStates(hass);
        }
    }

    static get styles(): CSSResult {
        return style;
    }

    render(): TemplateResult {
        if (!this._hass || !this.config) return html``;

        const { entity, info_entities, entities, rows, stateObj } = parseConfig(this.config, this._hass);

        try {
            return html`
                <ha-card elevation="2" style="${entityStyles(this.config.card_styles, stateObj, this._hass)}">
                    <div class="card-header">
                        ${renderTitle(this.config, this._hass, this, entity)}
                        <div class="entities-info-row">
                            ${info_entities.map((entity) => renderInfoEntity(entity, this._hass, this))}
                        </div>
                    </div>
                    ${rows !== undefined && rows.length > 0
                        ? renderRows(rows, this._hass, this)
                        : renderEntitiesRow(this.config, entities, this._hass, this)}
                    ${this.config.cards?.map((card) => this.createCardElement(card, this._hass))}
                </ha-card>
            `;
        } catch (error) {
            return html`<hui-warning>${(error as Error).toString()}</hui-warning>`;
        }
    }

    getCardSize(): number {
        const numberOfCards = this.config.cards ? this.config.cards.length : 0;
        const numberOfRows = this.config.rows ? this.config.rows.length : 0;
        const mainSize = !this.config.info_entities && this.config.hide_title ? 1 : 2;

        return (
            numberOfCards +
            numberOfRows +
            (this.config.entities ? (this.config.entities.length > 0 ? 1 : 0) : 0) +
            mainSize
        );
    }

    createCardElement(config: RoomCardLovelaceCardConfig, hass: HomeAssistant): LovelaceCard | undefined {
        const showStates = config.show_states;
        if (
            hideIfCard(config, hass) ||
            (showStates && config.entity && !showStates.includes(hass.states[config.entity]?.state))
        ) {
            return undefined;
        }

        let element: LovelaceCard;

        if (this._helpers) {
            element = this._helpers.createCardElement(config);
        } else {
            element = createThing(config);
        }

        element.hass = hass;
        element.style.boxShadow = 'none';
        element.style.borderRadius = '0';

        return element;
    }
}
