import { HomeAssistant } from 'custom-card-helpers';
import { evalTemplate } from './util';
import { HomeAssistantEntity, RoomCardAttributeTemplate, RoomCardConfig, RoomCardEntity, RoomCardIcon } from './types';

export const templateStyling = (
    stateObj: HomeAssistantEntity | undefined,
    config: RoomCardEntity | RoomCardConfig,
    hass: HomeAssistant,
): string | null => {
    const icon = config.icon as RoomCardIcon;

    return icon?.template?.styles !== undefined ? (evalTemplate(hass, stateObj, icon.template.styles) as unknown as string) : null;
};

export const mapTemplate = (entity: RoomCardEntity, config: RoomCardConfig): RoomCardEntity => {
    if (entity !== undefined && entity.template) {
        const templatesWithMatchingName = config.templates?.filter((template) => template.name === entity.template) ?? [];
        if (templatesWithMatchingName.length > 0) {
            const templateFromConfig = templatesWithMatchingName[0];

            return {
                ...templateFromConfig.template,
                ...entity,
                stateObj: entity.stateObj,
            } as RoomCardEntity;
        }
    }

    return entity;
};

export const getTemplateOrAttribute = (
    attribute: string | number | RoomCardAttributeTemplate | boolean | undefined,
    hass: HomeAssistant,
    stateObj: HomeAssistantEntity | undefined,
): string | number | boolean | undefined => {
    if (!attribute) {
        return attribute;
    }

    if (typeof attribute === 'object' && 'template' in attribute) {
        return evalTemplate(hass, stateObj, (attribute as RoomCardAttributeTemplate).template) as unknown as string;
    }

    return attribute;
};