import { ActionConfig as LegacyActionConfig, HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
import { HassEntity } from 'home-assistant-js-websocket';

export type ActionConfig = LegacyActionConfig | {
    action: 'perform-action';
    perform_action: string;
    data?: Record<string, unknown>;
    target?: { entity_id?: string | string[]; device_id?: string | string[]; area_id?: string | string[] };
    confirmation?: LegacyActionConfig['confirmation'];
} | {
    action: 'assist';
    pipeline_id?: string;
    start_listening?: boolean;
    confirmation?: LegacyActionConfig['confirmation'];
};

export interface RoomCardEntity {
    name?: string | RoomCardAttributeTemplate;
    entity?: string;
    tap_action?: ActionConfig;
    hold_action?: ActionConfig;
    double_tap_action?: ActionConfig;
    state_color?: boolean;
    show_name?: boolean;
    show_icon?: boolean;
    toggle?: boolean;
    format?: string;
    unit?: string;
    hide_unavailable?: boolean;
    hide_if?: HideIfConfig;
    stateObj: HomeAssistantEntity;
    attribute?: string;
    show_state?: boolean;
    styles?: EntityStyles | RoomCardAttributeTemplate;
    icon?: string | RoomCardIcon;
    template?: string;
    /** Width of an empty slot. Numbers are interpreted as pixels. */
    width?: string | number;
}

export type RoomCardEntityConfig = string | RoomCardEntity;

export interface EntityStyles {
    [key: string]: string | undefined;
    template?: string;
}

export interface RoomCardConfig extends LovelaceCardConfig {
    info_entities?: RoomCardEntityConfig[];
    entity?: string;
    hide_title?: boolean;
    cards?: RoomCardLovelaceCardConfig[];
    entityIds: string[];
    hass?: HomeAssistant;
    icon?: string | RoomCardIcon;
    rows?: RoomCardRow[];
    show_icon?: boolean;
    /** Main-icon state coloring defaults to true; set false to retain the neutral icon color. */
    state_color?: boolean;
    title?: string | RoomCardAttributeTemplate;
    styles?: EntityStyles | RoomCardAttributeTemplate;
    templates?: RoomCardTemplateContainer[];
    tap_action?: ActionConfig;
    hold_action?: ActionConfig;
    double_tap_action?: ActionConfig;
    card_styles?: EntityStyles;
    layout?: RoomCardLayout;
    /** Title font size in pixels. */
    title_size?: number;
    content_size?: RoomCardContentSize;
    title_wrap?: RoomCardTitleWrap;
    appearance?: RoomCardAppearance;
}

export type RoomCardLayout = 'default' | 'compact';
export type RoomCardContentSize = 'small' | 'default' | 'large';
export type RoomCardTitleWrap = 'auto' | 'wrap' | 'ellipsis';
export type RoomCardAppearanceTransition = 'none' | 'subtle';
export type RoomCardConditionOperator = 'equals' | 'not_equals' | 'above' | 'below';

export interface RoomCardAppearance {
    transition?: RoomCardAppearanceTransition;
    states?: RoomCardAppearanceRule[];
}

/** Fields are optional so an incomplete rule remains safe while it is edited visually. */
export interface RoomCardAppearanceRule {
    entity?: string;
    attribute?: string;
    condition?: RoomCardConditionOperator;
    value?: string | number | boolean;
    priority?: number;
    background?: string;
    accent?: string;
    foreground?: string;
    opacity?: number;
}

export enum RoomCardAlignment {
    Left = 'left',
    Center = 'center',
    Right = 'right',
}

export interface RoomCardRow {
    entities?: RoomCardEntityConfig[];
    hide_if?: HideIfConfig;
    content_alignment?: RoomCardAlignment;
}

export interface HomeAssistantEntity extends HassEntity {
    entity_id: string;
    state: string;
}

export interface RoomCardIcon {
    conditions?: EntityCondition[];
    state_on?: string;
    state_off?: string;
    template?: RoomCardIconTemplate;
}

export interface RoomCardIconTemplate {
    icon?: string;
    styles?: string;
}

export interface HideIfConfig {
    conditions?: EntityCondition[];
}

export interface EntityCondition {
    condition?: string;
    value?: string | number | boolean;
    attribute?: string;
    entity?: string;
    icon?: string;
    styles?: EntityStyles;
}

export interface RoomCardTemplateContainer {
    name: string;
    template: RoomCardTemplateDefinition;
}

export interface RoomCardTemplateDefinition {
    [key: string]: unknown;
}

export interface RoomCardLovelaceCardConfig extends LovelaceCardConfig {
    hide_if?: HideIfConfig;
    show_states?: string[];
    cards?: RoomCardLovelaceCardConfig[];
    entities?: (string | { entity: string })[];
}

export interface RoomCardAttributeTemplate {
    template: string;
}

export interface ActionHandlerElement extends HTMLElement {
    actionHandler?: boolean;
}
