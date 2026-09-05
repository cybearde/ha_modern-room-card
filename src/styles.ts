import { css } from 'lit';

export const style = css`
    ha-card {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: var(--modern-room-card-border-radius, var(--ha-card-border-radius, 12px));
    }

    ha-card .card-header {
        padding-bottom: 0px;
    }

    .icon-small {
        display: inline-block;
    }

    .entity {
        text-align: center;
        cursor: pointer;
    }

    .entity span {
        font-size: 10px;
    }

    .entities-row {
        flex-direction: row;
        flex-wrap: wrap;
        display: inline-flex;
        align-items: center;
        padding: 0 20px 10px 20px;
    }

    .entities-row .entity {
        margin-right: 16px;
    }

    .entity-placeholder {
        min-width: var(--modern-room-card-empty-slot-width, 40px);
        min-height: 40px;
        pointer-events: none;
        visibility: hidden;
    }

    .entities-row .entity:last-of-type,
    .entities-info-row .entity:last-of-type {
        margin-right: 0;
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
        flex-direction: row;
        flex-wrap: wrap;
        display: inline-flex;
        justify-content: center;
        align-items: center;
        padding: 0 20px 10px 20px;
        font-size: 12px;
        position: absolute;
        right: 20px;
        top: 15px;
    }

    .entities-info-row .entity {
        margin-right: 16px;
    }

    .entities-info-row .entity.icon-entity {
        margin-right: 0px;
    }

    .main-state {
        float: left;
        margin-right: 10px;
    }

    .main-state > ha-state-icon > ha-svg-icon {
        vertical-align: baseline;
    }

    .main-icon {
        vertical-align: baseline;
        font-size: 30px;
    }

    .title {
        min-height: 48px;
        display: flex;
        align-items: center;
        font-weight: 500;
        color: var(--modern-room-card-title-color, var(--primary-text-color));
    }

    .clickable {
        cursor: pointer;
    }

    .content-left {
        justify-content: left;
    }

    .content-center {
        justify-content: center;
    }

    .content-right {
        justify-content: right;
    }
`;
