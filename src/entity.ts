import {
    ActionHandlerEvent,
    computeStateDisplay,
    computeStateDomain,
    formatNumber,
    HomeAssistant,
} from 'custom-card-helpers';
import { html, HTMLTemplateResult, LitElement } from 'lit';
import {
    ActionConfig,
    EntityCondition,
    EntityStyles,
    HomeAssistantEntity,
    RoomCardAttributeTemplate,
    RoomCardConfig,
    RoomCardEntity,
    RoomCardIcon,
    RoomCardRow,
} from './types';
import { checkConditionalValue, evalTemplate, getValue, isObject, isUnavailable, renderClasses } from './util';
import { getTemplateOrAttribute, templateStyling } from './template';
import { hideIfEntity, hideIfRow } from './hide';
import { actionHandler } from './action-handler-directive';
import { secondsToDuration } from './lib/seconds_to_duration';
import { validateAppearanceConfig } from './appearance';

const hasAction = (action: ActionConfig | undefined): boolean => !!action && action.action !== 'none';

export const checkConfig = (config: RoomCardConfig): void => {
    if ('entities' in config) {
        throw new Error('Top-level entities are no longer supported; place them inside rows.');
    }
    if ('content_alignment' in config) {
        throw new Error('Top-level content_alignment is no longer supported; set it on each row.');
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
    if (
        config.entity == undefined &&
        config.info_entities === undefined &&
        config.rows === undefined &&
        config.cards === undefined
    ) {
        throw new Error('Please define a main entity, info entities, rows, or nested cards.');
    }
};

export const computeEntity = (entityId: string): string => entityId.substr(entityId.indexOf('.') + 1);

export const entityName = (entity: RoomCardEntity, hass: HomeAssistant): string | undefined => {
    const name = getTemplateOrAttribute(entity.name, hass, entity.stateObj);

    return (
        (name as string) ||
        (entity.entity ? entity.stateObj.attributes.friendly_name || computeEntity(entity.stateObj.entity_id) : null) ||
        undefined
    );
};

export const entityIcon = (
    stateObj: HomeAssistantEntity,
    config: RoomCardEntity | RoomCardConfig,
    hass: HomeAssistant,
): string | EntityCondition | undefined => {
    if (!config.icon) return stateObj.attributes.icon || undefined;
    if (typeof config.icon === 'string') return config.icon;

    if (config.icon!.state_on) return renderCustomStateIcon(stateObj, config.icon as RoomCardIcon);
    if (config.icon!.conditions) return renderConditionIcons(stateObj, config, hass);
    if (config.icon!.template?.icon) {
        return evalTemplate(hass, stateObj, config.icon!.template.icon) as unknown as string;
    }
    return undefined;
};

export const renderConditionIcons = (
    stateObj: HomeAssistantEntity,
    config: RoomCardEntity | RoomCardConfig,
    hass: HomeAssistant,
): EntityCondition | undefined => {
    const entityValue = stateObj.state;
    const iconConditions = (config.icon as RoomCardIcon).conditions as EntityCondition[];

    const matchedConditions = iconConditions.filter((item) => {
        let checkEntityValue = entityValue;

        if (item.entity) {
            const entity = hass.states[item.entity];
            if (!entity || isUnavailable(entity)) return false;
            checkEntityValue = item.attribute ? entity.attributes[item.attribute] : entity.state;
        } else if (item.attribute) {
            checkEntityValue = stateObj.attributes[item.attribute];
        }

        return checkConditionalValue(item, checkEntityValue);
    });

    return matchedConditions.pop();
};

export const renderCustomStateIcon = (stateObj: HomeAssistantEntity, icon: RoomCardIcon): string | undefined => {
    const domain = computeStateDomain(stateObj);

    switch (domain) {
        case 'light':
        case 'switch':
        case 'binary_sensor':
        case 'input_boolean':
            return stateObj.state === 'on' ? icon.state_on : icon.state_off;
    }
    return undefined;
};

export const entityStateDisplay = (hass: HomeAssistant, entity: RoomCardEntity): string => {
    if (isUnavailable(entity.stateObj)) {
        return hass.localize(`state.default.${entity.stateObj?.state ?? 'unavailable'}`) || entity.stateObj?.state || 'Unavailable';
    }

    let value: string | number | undefined = getValue(entity);
    if (value === undefined || value === null) return '—';
    let unit: string | undefined =
        entity.attribute !== undefined ? entity.unit : entity.unit || entity.stateObj.attributes.unit_of_measurement;

    if (entity.format) {
        ({ value, unit } = extractValue(entity, value, hass, unit));
        return `${value}${unit ? ` ${unit}` : ''}`;
    }

    if (entity.attribute) {
        return `${isNaN(Number(value)) ? value : formatNumber(value, hass.locale)}${unit ? ` ${unit}` : ''}`;
    }

    const modifiedStateObj = {
        ...entity.stateObj,
        attributes: { ...entity.stateObj.attributes, unit_of_measurement: unit },
    };

    return computeStateDisplay(hass.localize, modifiedStateObj, hass.locale);
};

export const entityStyles = (
    styles: EntityStyles | RoomCardAttributeTemplate | undefined,
    stateObj: HomeAssistantEntity | undefined,
    hass: HomeAssistant,
): string => {
    if (!styles) {
        return '';
    }

    if ('template' in styles) {
        const templateDefinition = styles as RoomCardAttributeTemplate;
        return evalTemplate(hass, stateObj, templateDefinition.template) as unknown as string;
    }

    const entityStylesConfig = styles as EntityStyles;
    return Object.keys(entityStylesConfig)
        .map((key) => {
            const value = entityStylesConfig[key];
            return value ? `${key}: ${value};` : '';
        })
        .join('');
};

export const renderIcon = (
    stateObj: HomeAssistantEntity,
    config: RoomCardEntity | RoomCardConfig,
    hass: HomeAssistant,
    classes?: string,
    defaultStateColor = false,
): HTMLTemplateResult | undefined => {
    if (config.show_icon !== undefined && config.show_icon === false) {
        return undefined;
    }

    const customIcon = entityIcon(stateObj, config, hass);
    const customStyling = templateStyling(stateObj, config, hass);

    return html`<state-badge
        class="icon-small ${classes}"
        .hass=${hass}
        .stateObj="${stateObj}"
        .overrideIcon="${isObject(customIcon) ? (customIcon as EntityCondition).icon : (customIcon as string)}"
        .stateColor=${config.state_color ?? defaultStateColor}
        style="${customStyling ??
        entityStyles(
            isObject(customIcon) ? (customIcon as EntityCondition).styles : undefined,
            hass.states[config.entity === undefined ? stateObj.entity_id : config.entity],
            hass,
        )}"
    ></state-badge>`;
};

export const renderValue = (
    entity: RoomCardEntity,
    hass: HomeAssistant,
): string | number | HTMLTemplateResult => {
    if (entity.toggle === true) {
        return html`<ha-entity-toggle .stateObj="${entity.stateObj}" .hass="${hass}"></ha-entity-toggle>`;
    }

    if (entity.show_icon === true) {
        return renderIcon(entity.stateObj, entity, hass) ?? '';
    }

    if (entity.attribute && ['last-changed', 'last-updated'].includes(entity.attribute)) {
        return html`<ha-relative-time
            .hass=${hass}
            .datetime=${entity.attribute === 'last-changed' ? entity.stateObj.last_changed : entity.stateObj.last_updated}
            capitalize
        ></ha-relative-time>`;
    }

    if (entity.format && ['relative', 'total', 'date', 'time', 'datetime'].includes(entity.format)) {
        const value = getValue(entity);
        if (value === undefined || value === null) return '—';
        const timestamp = new Date(value);
        if (isNaN(timestamp.getTime())) {
            return value;
        }
        return html`<hui-timestamp-display .hass=${hass} .ts=${timestamp} .format=${entity.format} capitalize></hui-timestamp-display>`;
    }

    return entityStateDisplay(hass, entity);
};

export const renderMainEntity = (
    entity: RoomCardEntity | undefined,
    config: RoomCardConfig,
    hass: HomeAssistant,
): HTMLTemplateResult | undefined => {
    if (entity === undefined || !entity.stateObj) {
        return undefined;
    }

    const stateObj = hass.states[entity.entity!];

    return html`<div class="main-state entity" style="${entityStyles(entity.styles, stateObj, hass)}">
        ${!config.rows?.some((row) => row.entities?.length) || config.icon
            ? renderIcon(entity.stateObj, config, hass, 'main-icon', true)
            : entity.show_state !== undefined && entity.show_state === false
              ? ''
              : renderValue(entity, hass)}
    </div>`;
};

export const clickHandler = (element: LitElement, hass: HomeAssistant, entity: RoomCardEntity, ev: ActionHandlerEvent): void => {
    // Let Home Assistant execute actions, including Assist and confirmation dialogs.
    const { entity: entityId, tap_action, hold_action, double_tap_action } = entity;
    element.dispatchEvent(new CustomEvent('hass-action', {
        bubbles: true,
        composed: true,
        detail: { config: { entity: entityId, tap_action, hold_action, double_tap_action }, action: ev.detail.action },
    }));
};

export const renderTitle = (
    config: RoomCardConfig,
    hass: HomeAssistant,
    element: LitElement,
    entity?: RoomCardEntity,
    infoEntities: Array<HTMLTemplateResult | undefined> = [],
): HTMLTemplateResult | undefined => {
    if (config.hide_title === true && infoEntities.length === 0) {
        return undefined;
    }

    const handleActionEvent = (ev: ActionHandlerEvent): void => {
        if (hass && ev.detail.action) {
            clickHandler(
                element,
                hass,
                (entity ?? { ...config }) as unknown as RoomCardEntity,
                ev,
            );
        }
    };

    const hasConfigAction =
        config.tap_action !== undefined || config.hold_action !== undefined || config.double_tap_action !== undefined;
    const title = getTemplateOrAttribute(config.title, hass, entity?.stateObj);

    return html`<div class="title${hasConfigAction ? ' clickable' : ''}" @action=${handleActionEvent}
        .actionHandler=${actionHandler({
            hasHold: hasAction(config.hold_action),
            hasDoubleClick: hasAction(config.double_tap_action),
        })}>
        ${config.hide_title === true
            ? ''
            : html`${renderMainEntity(entity, config, hass)} <span class="title-text">${title}</span>`}
        <div class="entities-info-row">${infoEntities}</div>
    </div>`;
};

export const renderInfoEntity = (
    entity: RoomCardEntity,
    hass: HomeAssistant,
    element: LitElement,
): HTMLTemplateResult | undefined => {
    if (entity === undefined || !entity.stateObj || hideIfEntity(entity, hass)) {
        return undefined;
    }

    const handleActionEvent = (ev: ActionHandlerEvent): void => {
        // The info row lives inside the actionable title container. Keep an
        // info-entity action from also invoking the title action.
        ev.stopPropagation();
        if (hass && entity && ev.detail.action) {
            clickHandler(element, hass, entity, ev);
        }
    };

    return html`<div class="state entity ${entity.show_icon === true ? 'icon-entity' : ''}"
        style="${entityStyles(entity.styles, entity.stateObj, hass)}"
        @action=${handleActionEvent}
        .actionHandler=${actionHandler({
            hasHold: hasAction(entity.hold_action),
            hasDoubleClick: hasAction(entity.double_tap_action),
        })}>${renderValue(entity, hass)}</div>`;
};

export const renderEntitiesRow = (
    config: RoomCardRow,
    entities: RoomCardEntity[] | undefined,
    hass: HomeAssistant,
    element: LitElement,
    classes?: string,
): HTMLTemplateResult | undefined => {
    if (entities === undefined) {
        return undefined;
    }

    return html`<div class="${renderClasses(config, classes)}">${entities.map((entity) => renderEntity(entity, hass, element))}</div>`;
};

export const renderEntity = (
    entity: RoomCardEntity,
    hass: HomeAssistant,
    element: LitElement,
): HTMLTemplateResult | undefined => {
    // Empty objects are intentional spacers for asymmetric layouts.
    if (!entity.entity && !entity.template) {
        const width =
            typeof entity.width === 'number'
                ? `${entity.width}px`
                : entity.width?.trim();
        return html`<div
            class="entity entity-placeholder"
            style=${width ? `--modern-room-card-slot-width: ${width}` : ''}
            aria-hidden="true"
        ></div>`;
    }

    if (entity.stateObj == undefined || hideIfEntity(entity, hass)) {
        return undefined;
    }

    const handleActionEvent = (ev: ActionHandlerEvent): void => {
        if (hass && entity && ev.detail.action) {
            clickHandler(element, hass, entity, ev);
        }
    };

    return html`<div class="entity" style="${entityStyles(entity.styles, entity.stateObj, hass)}"
        @action=${handleActionEvent}
        .actionHandler=${actionHandler({
            hasHold: hasAction(entity.hold_action),
            hasDoubleClick: hasAction(entity.double_tap_action),
        })}>
        ${entity.show_name === undefined || entity.show_name ? html`<span>${entityName(entity, hass)}</span>` : ''}
        <div>${renderIcon(entity.stateObj, entity, hass)}</div>
        ${entity.show_state ? html`<span>${entityStateDisplay(hass, entity)}</span>` : ''}
    </div>`;
};

export const renderRows = (rows: RoomCardRow[] | undefined, hass: HomeAssistant, element: LitElement): HTMLTemplateResult | undefined => {
    if (rows === undefined) {
        return undefined;
    }

    const filteredRows = rows.filter((row) => !hideIfRow(row, hass));

    return html`${filteredRows.map((row) =>
        renderEntitiesRow(row, row.entities as RoomCardEntity[] | undefined, hass, element),
    )}`;
};

export const extractValue = (
    entity: RoomCardEntity,
    value: any,
    hass: HomeAssistant,
    unit: string | undefined,
): { value: string | number | undefined; unit: string | undefined } => {
    if (entity.format?.startsWith('precision')) {
        const precision = parseInt(entity.format.slice(-1), 10);
        value = formatNumber(value, hass.locale, {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision,
        });
    } else if (isNaN(parseFloat(value)) || !isFinite(value)) {
    } else if (entity.format === 'brightness') {
        value = Math.round((value / 255) * 100);
        unit = '%';
    } else if (entity.format?.startsWith('duration')) {
        value = secondsToDuration(entity.format === 'duration-m' ? value / 1000 : value);
        unit = undefined;
    } else if (entity.format === 'kilo') {
        value = formatNumber(value / 1000, hass.locale, { maximumFractionDigits: 2 });
    } else if (entity.format === 'invert') {
        value = formatNumber(value - value * 2, hass.locale);
    } else if (entity.format === 'position') {
        value = formatNumber(100 - value, hass.locale);
    }

    return { value, unit };
};
