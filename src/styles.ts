import { css } from 'lit';

export const style = css`
    ha-card {
        --modern-room-card-content-scale: 1;
        display: flex;
        flex-direction: column;
        isolation: isolate;
        box-sizing: border-box;
        max-width: 100%;
        min-width: 0;
        overflow: hidden;
        position: relative;
        border-radius: var(--modern-room-card-border-radius, var(--ha-card-border-radius, 12px));
    }

    ha-card.appearance-active {
        color: var(--modern-room-card-conditional-foreground, inherit);
    }

    ha-card.appearance-active::before {
        background: var(--modern-room-card-conditional-background, transparent);
        border-radius: inherit;
        content: '';
        inset: 0;
        opacity: var(--modern-room-card-conditional-background-opacity, 1);
        pointer-events: none;
        position: absolute;
        z-index: 0;
    }

    ha-card > * {
        position: relative;
        z-index: 1;
    }

    ha-card.appearance-subtle {
        transition: color 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
    }

    ha-card.appearance-subtle::before {
        transition: background 200ms ease, opacity 200ms ease;
    }

    @media (prefers-reduced-motion: reduce) {
        ha-card.appearance-subtle,
        ha-card.appearance-subtle::before {
            transition: none;
        }
    }

    ha-card .card-header {
        padding-bottom: 0px;
        position: relative;
    }

    .icon-small {
        display: inline-block;
        height: calc(40px * var(--modern-room-card-content-scale));
        width: calc(40px * var(--modern-room-card-content-scale));
        --mdc-icon-size: calc(24px * var(--modern-room-card-content-scale));
    }

    .entity {
        cursor: pointer;
        max-width: 100%;
        min-width: 0;
        overflow-wrap: anywhere;
        text-align: center;
    }

    .entity span {
        font-size: calc(10px * var(--modern-room-card-content-scale));
    }

    .entities-row {
        align-items: center;
        box-sizing: border-box;
        display: inline-flex;
        flex-direction: row;
        flex-wrap: wrap;
        max-width: 100%;
        min-width: 0;
        padding-block: 0 10px;
        padding-inline: 20px;
        width: 100%;
    }

    .entities-row .entity {
        margin-inline-end: 16px;
    }

    .entity-placeholder {
        min-width: var(--modern-room-card-slot-width, var(--modern-room-card-empty-slot-width, 40px));
        min-height: calc(40px * var(--modern-room-card-content-scale));
        pointer-events: none;
        visibility: hidden;
    }

    .entities-row .entity:last-of-type,
    .entities-info-row .entity:last-of-type {
        margin-inline-end: 0;
    }

    .entities-row .entity,
    .entities-info-row .entity {
        transition: transform 0.1s ease-in-out, opacity 0.1s ease-in-out;
    }

    .entities-row .entity:hover,
    .entities-info-row .entity:hover {
        transform: scale(1.1);
        opacity: 0.8;
    }

    .entities-column {
        flex-direction: column;
        display: flex;
        align-items: flex-end;
        justify-content: space-evenly;
    }

    .entities-column .entity div {
        display: inline-block;
        vertical-align: middle;
    }

    .entities-info-row {
        align-items: center;
        display: inline-flex;
        flex: 0 0 auto;
        flex-direction: row;
        flex-wrap: wrap;
        font-size: calc(12px * var(--modern-room-card-content-scale));
        justify-content: flex-end;
        margin-inline-end: 4px;
        margin-inline-start: auto;
        max-width: 100%;
        min-width: 0;
    }

    .entities-info-row .entity {
        margin-inline-end: 16px;
    }

    .entities-info-row .entity.icon-entity {
        margin-inline-end: 0;
    }

    .main-state {
        align-self: stretch;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-inline-end: 10px;
    }

    .main-state > ha-state-icon > ha-svg-icon {
        vertical-align: baseline;
    }

    .main-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        vertical-align: middle;
    }

    .title {
        align-items: center;
        display: flex;
        font-weight: 500;
        max-width: 100%;
        min-width: 0;
        width: 100%;
        color: var(
            --modern-room-card-title-color,
            var(--modern-room-card-conditional-foreground, var(--primary-text-color))
        );
    }

    .title-text {
        flex: 1 1 auto;
        font-size: var(--modern-room-card-title-size, 18px);
        line-height: 1.25;
        min-width: 0;
    }

    ha-card.title-auto .title-text {
        overflow-wrap: normal;
        white-space: normal;
    }

    ha-card.title-wrap .title-text {
        overflow-wrap: anywhere;
        white-space: normal;
    }

    ha-card.title-ellipsis .title-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    ha-card.content-size-small {
        --modern-room-card-content-scale: 0.85;
    }

    ha-card.content-size-large {
        --modern-room-card-content-scale: 1.15;
    }

    .clickable {
        cursor: pointer;
    }

    .clickable:focus-visible,
    .entity:focus-visible {
        border-radius: var(--ha-border-radius-sm, 4px);
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }

    .content-left {
        justify-content: flex-start;
    }

    .content-center {
        justify-content: center;
    }

    .content-right {
        justify-content: flex-end;
    }

    /* Native replacement for the common compact card-mod layout overrides. */
    ha-card.compact .card-header {
        padding: var(--modern-room-card-compact-padding, 8px);
    }

    ha-card.compact .entities-row {
        padding-block: 0 var(--modern-room-card-compact-padding, 8px);
        padding-inline: var(--modern-room-card-compact-padding, 8px);
    }

    ha-card.compact .entities-row .entity {
        inset-inline-start: var(
            --modern-room-card-compact-entity-inline-offset,
            var(--modern-room-card-compact-entity-left, -2px)
        );
        margin-inline-end: var(--modern-room-card-compact-entity-gap, -8px);
        position: relative;
        top: var(--modern-room-card-compact-entity-top, -0px);
    }

    ha-card.compact .entities-row .entity:last-of-type {
        margin-inline-end: 0;
    }

    ha-card.compact .main-state {
        width: calc(var(--modern-room-card-compact-main-width, 32px) * var(--modern-room-card-content-scale));
    }

    ha-card.compact .entities-row .icon-small {
        inset-inline-start: var(
            --modern-room-card-compact-row-icon-inline-offset,
            var(--modern-room-card-compact-row-icon-left, -2px)
        );
        position: relative;
        top: var(--modern-room-card-compact-row-icon-top, 4px);
    }

`;
