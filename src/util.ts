import { HomeAssistant } from 'custom-card-helpers';
import { html, PropertyValues } from 'lit';
import { HassEntity } from 'home-assistant-js-websocket';
import {
    EntityCondition,
    HideIfConfig,
    HomeAssistantEntity,
    RoomCardConfig,
    RoomCardEntity,
    RoomCardLovelaceCardConfig,
    RoomCardRow,
    RoomCardIcon,
} from './types';
import { mapTemplate } from './template';

export const UNAVAILABLE_STATES = ['unavailable', 'unknown'];

export const isObject = (obj: unknown): boolean => typeof obj === 'object' && !Array.isArray(obj) && !!obj;

export const isUnavailable = (stateObj: HomeAssistantEntity): boolean =>
    !stateObj || UNAVAILABLE_STATES.includes(stateObj.state);

export const getValue = (entity: RoomCardEntity): string | number => {
    if (entity.attribute && entity.stateObj.attributes[entity.attribute] === undefined) {
        throw new Error(`Entity: '${entity.entity}' has no attribute named '${entity.attribute}'`);
    }

    return entity.attribute ? entity.stateObj.attributes[entity.attribute] : entity.stateObj.state;
};

export const getEntity = (entity?: string | { entity?: string }): string | undefined =>
    entity === undefined ? undefined : typeof entity === 'string' ? entity : entity.entity;

export const getEntityIds = (config: RoomCardConfig): string[] => {
    const entities: (string | undefined)[] = [config.entity];
    config.entities?.forEach((entity) => entities.push(getEntity(entity)));
    config.info_entities?.forEach((entity) => entities.push(getEntity(entity)));
    config.rows?.forEach((row) => row.entities?.forEach((entity) => entities.push(getEntity(entity))));
    config.cards?.forEach((card) => entities.push(...getCardEntities(card)));
    entities.push(...getConditionEntitiesFromConfig(config));

    return [...new Set(entities.filter((entity): entity is string => entity !== undefined && entity.length > 0))];
};

const getConditionEntities = (entities: RoomCardEntity[] | undefined): EntityCondition[] => {
    let conditions: EntityCondition[] = [];

    entities?.forEach((entity) => {
        const iconConditions = (entity?.icon as RoomCardIcon)?.conditions?.filter((x) => x.entity !== undefined);
        if (iconConditions) {
            conditions = conditions.concat(iconConditions);
        }
        const hideConditions = (entity?.hide_if as HideIfConfig)?.conditions?.filter((x) => x.entity !== undefined);
        if (hideConditions) {
            conditions = conditions.concat(hideConditions);
        }
    });

    return conditions;
};

const getConditionEntitiesFromConfig = (config: RoomCardConfig): string[] => {
    const rows = config.rows?.map((row) => row.entities) ?? [];
    const entities = [config.entities, config.info_entities, ...rows];
    const flattendEntities = entities
        .flatMap((entities) => entities)
        .filter((entity): entity is RoomCardEntity => entity !== undefined);
    const conditionWithEntities = getConditionEntities(flattendEntities);

    return conditionWithEntities.filter((condition) => condition.entity).map((condition) => condition.entity) as string[];
};

export const getCardEntities = (card: RoomCardLovelaceCardConfig): string[] => {
    const entities: (string | undefined)[] = [getEntity(card.entity)];
    (card.hide_if as HideIfConfig | undefined)?.conditions?.forEach((condition) => entities.push(condition.entity));
    card.cards?.forEach((nested) => entities.push(...getCardEntities(nested)));
    card.entities?.forEach((entity) => entities.push(getEntity(entity)));

    return entities.filter((entity): entity is string => entity !== undefined && entity.length > 0);
};

export const hasConfigOrEntitiesChanged = (node: RoomCardConfig, changedProps: PropertyValues): boolean => {
    if (changedProps.has('config')) {
        return true;
    }

    const oldHass = changedProps.get('_hass') as HomeAssistant | undefined;
    if (oldHass) {
        return node.entityIds.some((entity: string) => oldHass.states[entity] !== node.hass?.states[entity]);
    }
    return false;
};

export const checkConditionalValue = (item: EntityCondition, checkValue: unknown): boolean => {
    const itemValue = typeof item.value === 'boolean' ? String(item.value) : item.value;
    if (itemValue === undefined) {
        return false;
    }
    if (item.condition === 'equals' && checkValue == itemValue) {
        return true;
    }
    if (item.condition === 'not_equals' && checkValue != itemValue) {
        return true;
    }
    const numericCheck = Number(checkValue);
    if (item.condition === 'above' && !isNaN(numericCheck) && numericCheck > Number(itemValue)) {
        return true;
    }
    if (item.condition === 'below' && !isNaN(numericCheck) && numericCheck < Number(itemValue)) {
        return true;
    }
    return false;
};

export const mapStateObject = (
    entity: RoomCardEntity | string,
    hass: HomeAssistant,
    config: RoomCardConfig,
): RoomCardEntity => {
    let conf = typeof entity === 'string' ? { entity: entity } : entity;

    conf = mapTemplate(conf as RoomCardEntity, config);

    return { ...conf, stateObj: conf.entity ? hass.states[conf.entity] : undefined } as RoomCardEntity;
};

export const evalTemplate = (hass: HomeAssistant | undefined, state: HassEntity | undefined, func: string): Function => {
    try {
        return new Function('states', 'entity', 'user', 'hass', 'html', `'use strict'; ${func}`).call(
            this,
            hass?.states,
            state,
            hass?.user,
            hass,
            html,
        );
    } catch (e) {
        const error = e as Error;
        const funcTrimmed = func.length > 100 ? `${func.trim().substring(0, 98)}...` : func.trim();
        error.message = `${error.name}: ${error.message} in '${funcTrimmed}'`;
        error.name = 'ModernRoomCardJSTemplateError';
        throw error;
    }
};

export const renderClasses = (config: RoomCardConfig | RoomCardRow, classes?: string): string =>
    `entities-row ${config.content_alignment ? `content-${config.content_alignment}` : 'content-left'}${
        classes !== undefined ? ` ${classes}` : ''
    }`;

export const parseConfig = (
    config?: RoomCardConfig,
    hass?: HomeAssistant,
): {
    entity?: RoomCardEntity;
    info_entities: RoomCardEntity[];
    entities: RoomCardEntity[];
    rows?: RoomCardRow[];
    stateObj?: HomeAssistantEntity;
} => {
    const result = { info_entities: [], entities: [] } as {
        entity?: RoomCardEntity;
        info_entities: RoomCardEntity[];
        entities: RoomCardEntity[];
        rows?: RoomCardRow[];
        stateObj?: HomeAssistantEntity;
    };

    if (!hass || !config) return result;

    result.stateObj = config.entity !== undefined ? hass.states[config.entity] : undefined;
    result.entity =
        config.entity !== undefined
            ? ({ ...config, stateObj: result.stateObj } as unknown as RoomCardEntity)
            : undefined;
    result.info_entities = config.info_entities?.map((entity) => mapStateObject(entity, hass, config)) ?? [];
    result.entities = config.entities?.map((entity) => mapStateObject(entity, hass, config)) ?? [];

    result.rows =
        config.rows?.map((row) => {
            const rowEntities = row.entities?.map((entity) => mapStateObject(entity, hass, config));
            return { entities: rowEntities, hide_if: row.hide_if, content_alignment: row.content_alignment };
        }) ?? [];

    return result;
};
