import { describe, expect, it } from 'vitest';
import ModernRoomCard from '../src/index';

describe('native layout options', () => {
    it('rejects the removed top-level entity model at runtime', async () => {
        const card = new ModernRoomCard();

        expect(
            () => card.setConfig({ type: 'custom:modern-room-card', entities: ['light.office'] } as any),
        ).toThrow('Top-level entities are no longer supported');
        expect(
            () => card.setConfig({ type: 'custom:modern-room-card', content_alignment: 'center', rows: [] } as any),
        ).toThrow('Top-level content_alignment is no longer supported');
    });

    it('uses one flex layout for the title and info entities', async () => {
        const card = new ModernRoomCard();
        await card.setConfig({
            type: 'custom:modern-room-card',
            title: 'Living room',
            info_entities: [],
            rows: [],
        } as any);
        document.body.append(card);
        card.hass = {
            states: {},
            locale: { language: 'en' },
            localize: (key: string) => key,
        } as any;
        await card.updateComplete;

        expect(card.shadowRoot!.querySelector('.title > .entities-info-row')).not.toBeNull();
        expect(card.shadowRoot!.querySelector('.card-header > .entities-info-row')).toBeNull();
        expect(ModernRoomCard.styles.cssText).toContain('align-self: stretch');
        expect(ModernRoomCard.styles.cssText).toContain('justify-content: flex-end');
        expect(ModernRoomCard.styles.cssText).toContain('margin-inline-start: auto');
        expect(ModernRoomCard.styles.cssText).toContain('line-height: 1');
        expect(ModernRoomCard.styles.cssText).toContain('margin-inline-end: 4px');
        expect(ModernRoomCard.styles.cssText).not.toContain('min-height: 48px');
        expect(ModernRoomCard.styles.cssText).toContain('padding: var(--modern-room-card-compact-padding, 8px)');
        expect(ModernRoomCard.styles.cssText).toContain(
            'top: var(--modern-room-card-compact-entity-top, -4px)',
        );
        expect(ModernRoomCard.styles.cssText).not.toContain(
            'font-size: calc(30px * var(--modern-room-card-content-scale))',
        );
        expect(ModernRoomCard.styles.cssText).not.toContain('--modern-room-card-info-offset-y');
        expect(ModernRoomCard.styles.cssText).not.toContain('--modern-room-card-compact-info-top');
        expect(ModernRoomCard.styles.cssText).not.toContain('--modern-room-card-compact-info-icon-top');
        expect(ModernRoomCard.styles.cssText).not.toContain('--modern-room-card-main-icon-offset-y');
    });

    it('uses direction-aware alignment and logical horizontal properties', () => {
        const css = ModernRoomCard.styles.cssText;
        expect(css).toContain('.content-left');
        expect(css).toContain('justify-content: flex-start');
        expect(css).toContain('justify-content: center');
        expect(css).toContain('justify-content: flex-end');
        expect(css).toContain('padding-inline: 20px');
        expect(css).toContain('inset-inline-start: var(');
        expect(css).not.toMatch(/margin-(left|right):/);
        expect(css).not.toMatch(/padding-(left|right):/);
        expect(css).not.toMatch(/(?:^|\s)(?:left|right):/m);
    });

    it('makes actionable titles and entities keyboard focusable', async () => {
        const card = new ModernRoomCard();
        await card.setConfig({
            type: 'custom:modern-room-card',
            title: 'Focusable room',
            tap_action: { action: 'toggle' },
            rows: [{ entities: ['light.office'] }],
        } as any);
        document.body.append(card);
        card.hass = {
            states: {
                'light.office': { entity_id: 'light.office', state: 'on', attributes: {} },
            },
            locale: { language: 'en' },
            localize: (key: string) => key,
        } as any;
        await card.updateComplete;

        const title = card.shadowRoot!.querySelector('.title') as HTMLElement;
        const entity = card.shadowRoot!.querySelector('.entities-row .entity') as HTMLElement;
        expect(title.tabIndex).toBe(0);
        expect(title.getAttribute('role')).toBe('button');
        expect(entity.tabIndex).toBe(0);
        expect(ModernRoomCard.styles.cssText).toContain('.entity:focus-visible');
    });

    it('applies the compact preset and a per-slot width', async () => {
        const card = new ModernRoomCard();
        await card.setConfig({
            type: 'custom:modern-room-card',
            layout: 'compact',
            rows: [{ entities: [{ width: 10 }] }, { entities: [{ width: 20 }] }],
        } as any);
        document.body.append(card);
        card.hass = {
            states: {},
            locale: { language: 'en' },
            localize: (key: string) => key,
        } as any;
        await card.updateComplete;

        expect(card.shadowRoot!.querySelector('ha-card')!.classList.contains('compact')).toBe(true);
        const rows = card.shadowRoot!.querySelectorAll('.entities-row');
        const placeholders = card.shadowRoot!.querySelectorAll('.entity-placeholder');
        expect(rows).toHaveLength(2);
        expect(placeholders[0].getAttribute('style')).toContain(
            '--modern-room-card-slot-width: 10px',
        );
        expect(placeholders[1].getAttribute('style')).toContain('--modern-room-card-slot-width: 20px');
    });

    it('uses Home Assistant state coloring for the main icon without changing row defaults', async () => {
        const renderCard = async (stateColor?: boolean) => {
            const card = new ModernRoomCard();
            await card.setConfig({
                type: 'custom:modern-room-card',
                entity: 'light.office',
                icon: 'mdi:lightbulb',
                show_icon: true,
                state_color: stateColor,
                rows: [{ entities: [{ entity: 'light.office', show_icon: true }] }],
            } as any);
            document.body.append(card);
            card.hass = {
                states: {
                    'light.office': { entity_id: 'light.office', state: 'on', attributes: {} },
                },
                locale: { language: 'en' },
                localize: (key: string) => key,
            } as any;
            await card.updateComplete;
            return card;
        };

        const defaultCard = await renderCard();
        expect((defaultCard.shadowRoot!.querySelector('.main-icon') as any).stateColor).toBe(true);
        expect((defaultCard.shadowRoot!.querySelector('.entities-row state-badge') as any).stateColor).toBe(false);

        const disabledCard = await renderCard(false);
        expect((disabledCard.shadowRoot!.querySelector('.main-icon') as any).stateColor).toBe(false);
    });

    it('sizes title and content without transform scaling', async () => {
        const card = new ModernRoomCard();
        await card.setConfig({
            type: 'custom:modern-room-card',
            title: 'A deliberately long room title',
            title_size: 26,
            content_size: 'large',
            title_wrap: 'ellipsis',
            rows: [{ entities: [{ width: 10 }] }],
        } as any);
        document.body.append(card);
        card.hass = {
            states: {},
            locale: { language: 'en' },
            localize: (key: string) => key,
        } as any;
        await card.updateComplete;

        const haCard = card.shadowRoot!.querySelector('ha-card')!;
        expect(haCard.classList.contains('content-size-large')).toBe(true);
        expect(haCard.classList.contains('title-ellipsis')).toBe(true);
        expect((haCard as HTMLElement).style.getPropertyValue('--modern-room-card-title-size')).toBe('26px');
        expect(card.shadowRoot!.querySelector('.title-text')?.textContent).toBe('A deliberately long room title');
        expect(ModernRoomCard.styles.cssText).toContain('--modern-room-card-content-scale: 1.15');
        expect(ModernRoomCard.styles.cssText).toContain('text-overflow: ellipsis');
        expect(ModernRoomCard.styles.cssText).not.toContain('transform: scale(var(--modern-room-card-content-scale');
    });
});
