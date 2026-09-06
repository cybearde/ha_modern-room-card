import { HomeAssistant } from 'custom-card-helpers';
import {
    EntityStyles,
    HomeAssistantEntity,
    RoomCardAppearance,
    RoomCardAppearanceRule,
    RoomCardConditionOperator,
} from './types';
import { checkConditionalValue, UNAVAILABLE_STATES } from './util';

const CONDITION_OPERATORS: RoomCardConditionOperator[] = ['equals', 'not_equals', 'above', 'below'];
const ENTITY_COLOR = 'entity-color';
const THEME_ACCENT_FALLBACK = 'var(--primary-color)';

export interface ResolvedAppearance {
    rule?: RoomCardAppearanceRule;
    styles: Record<string, string>;
}

const hasComparisonValue = (value: unknown): boolean =>
    value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');

export const validateAppearanceConfig = (appearance: RoomCardAppearance | undefined): void => {
    if (appearance === undefined) return;
    if (!appearance || typeof appearance !== 'object' || Array.isArray(appearance)) {
        throw new Error('appearance must be an object.');
    }
    if (appearance.transition !== undefined && !['none', 'subtle'].includes(appearance.transition)) {
        throw new Error("appearance.transition must be 'none' or 'subtle'.");
    }
    if (appearance.states !== undefined && !Array.isArray(appearance.states)) {
        throw new Error('appearance.states must be a list.');
    }
    appearance.states?.forEach((rule, index) => {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
            throw new Error(`appearance.states[${index}] must be an object.`);
        }
        if (rule.condition !== undefined && !CONDITION_OPERATORS.includes(rule.condition)) {
            throw new Error(`appearance.states[${index}].condition is invalid.`);
        }
        if (rule.priority !== undefined && (typeof rule.priority !== 'number' || !Number.isFinite(rule.priority))) {
            throw new Error(`appearance.states[${index}].priority must be numeric.`);
        }
        if (
            rule.opacity !== undefined &&
            (typeof rule.opacity !== 'number' || !Number.isFinite(rule.opacity) || rule.opacity < 0 || rule.opacity > 1)
        ) {
            throw new Error(`appearance.states[${index}].opacity must be between 0 and 1.`);
        }
    });
};

export const appearanceRuleMatches = (rule: RoomCardAppearanceRule, hass: HomeAssistant): boolean => {
    if (!rule.entity || !rule.condition || !CONDITION_OPERATORS.includes(rule.condition) || !hasComparisonValue(rule.value)) {
        return false;
    }
    const stateObj = hass.states[rule.entity] as HomeAssistantEntity | undefined;
    if (!stateObj || UNAVAILABLE_STATES.includes(stateObj.state)) return false;
    const actualValue = rule.attribute ? stateObj.attributes?.[rule.attribute] : stateObj.state;
    if (actualValue === undefined || actualValue === null) return false;
    return checkConditionalValue(rule, actualValue);
};

export const selectAppearanceRule = (
    appearance: RoomCardAppearance | undefined,
    hass: HomeAssistant,
): RoomCardAppearanceRule | undefined => {
    let selected: RoomCardAppearanceRule | undefined;
    let selectedPriority = -Infinity;
    for (const rule of appearance?.states ?? []) {
        if (!appearanceRuleMatches(rule, hass)) continue;
        const priority = typeof rule.priority === 'number' && Number.isFinite(rule.priority) ? rule.priority : 0;
        // Strictly greater preserves the first matching rule when priorities are equal.
        if (priority > selectedPriority) {
            selected = rule;
            selectedPriority = priority;
        }
    }
    return selected;
};

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

/** Approximation suitable for deriving a CSS preview color from a light's color temperature. */
export const kelvinToRgb = (kelvin: number): string | undefined => {
    if (!Number.isFinite(kelvin) || kelvin <= 0) return undefined;
    const temperature = Math.max(10, Math.min(400, kelvin / 100));
    const red = temperature <= 66 ? 255 : 329.698727446 * Math.pow(temperature - 60, -0.1332047592);
    const green =
        temperature <= 66
            ? 99.4708025861 * Math.log(temperature) - 161.1195681661
            : 288.1221695283 * Math.pow(temperature - 60, -0.0755148492);
    const blue = temperature >= 66 ? 255 : temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.044792731;
    return `rgb(${clampByte(red)}, ${clampByte(green)}, ${clampByte(blue)})`;
};

const cssToken = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

export const resolveEntityColor = (entityId: string, hass: HomeAssistant): string => {
    const stateObj = hass.states[entityId] as HomeAssistantEntity | undefined;
    if (!stateObj) return THEME_ACCENT_FALLBACK;
    const rgb = stateObj.attributes?.rgb_color;
    if (Array.isArray(rgb) && rgb.length >= 3 && rgb.slice(0, 3).every((value) => Number.isFinite(Number(value)))) {
        return `rgb(${clampByte(Number(rgb[0]))}, ${clampByte(Number(rgb[1]))}, ${clampByte(Number(rgb[2]))})`;
    }
    const temperature = Number(stateObj.attributes?.color_temp_kelvin);
    if (Number.isFinite(temperature) && temperature > 0) {
        return kelvinToRgb(temperature) ?? THEME_ACCENT_FALLBACK;
    }
    const domain = cssToken(entityId.split('.')[0] || 'entity');
    const state = cssToken(stateObj.state || 'default');
    return `var(--state-${domain}-${state}-color, var(--state-${domain}-color, var(--state-icon-active-color, ${THEME_ACCENT_FALLBACK})))`;
};

const resolveColor = (value: string | undefined, rule: RoomCardAppearanceRule, hass: HomeAssistant): string | undefined =>
    value === ENTITY_COLOR && rule.entity ? resolveEntityColor(rule.entity, hass) : value;

const hasStyle = (styles: EntityStyles | undefined, keys: string[]): boolean =>
    keys.some((key) => typeof styles?.[key] === 'string' && styles[key]!.trim().length > 0);

export const resolveAppearance = (
    appearance: RoomCardAppearance | undefined,
    hass: HomeAssistant,
    cardStyles?: EntityStyles,
): ResolvedAppearance => {
    const rule = selectAppearanceRule(appearance, hass);
    if (!rule) return { styles: {} };
    const styles: Record<string, string> = {};
    const background = resolveColor(rule.background, rule, hass);
    const foreground = resolveColor(rule.foreground, rule, hass);
    const accent = resolveColor(rule.accent, rule, hass);
    if (
        background &&
        !hasStyle(cardStyles, ['background', 'background-color', '--ha-card-background', '--card-background-color'])
    ) {
        styles['--modern-room-card-conditional-background'] = background;
        const defaultOpacity = rule.background === ENTITY_COLOR ? 0.12 : 1;
        const opacity = typeof rule.opacity === 'number' && Number.isFinite(rule.opacity) ? rule.opacity : defaultOpacity;
        styles['--modern-room-card-conditional-background-opacity'] = String(Math.max(0, Math.min(1, opacity)));
    }
    if (foreground && !hasStyle(cardStyles, ['color', '--primary-text-color', '--ha-color-text-primary'])) {
        styles['--modern-room-card-conditional-foreground'] = foreground;
        // Home Assistant children do not all inherit `color`; keep the override card-scoped and only expose it
        // when a matching rule explicitly configures a foreground.
        styles['--primary-text-color'] = 'var(--modern-room-card-conditional-foreground)';
        styles['--secondary-text-color'] = 'var(--modern-room-card-conditional-foreground)';
        styles['--ha-color-text-primary'] = 'var(--modern-room-card-conditional-foreground)';
        styles['--ha-color-text-secondary'] = 'var(--modern-room-card-conditional-foreground)';
    }
    if (accent) styles['--modern-room-card-accent'] = accent;
    return { rule, styles };
};
