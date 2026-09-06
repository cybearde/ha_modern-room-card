import { noChange } from 'lit';
import { AttributePart, directive, DirectiveParameters } from 'lit/directive.js';
import { AsyncDirective } from 'lit/async-directive.js';
import { ActionHandlerOptions, fireEvent } from 'custom-card-helpers';
import { ActionHandlerElement } from './types';

/** Each actionable region owns its gestures; nested regions never activate their parent. */
class ActionHandlerDirective extends AsyncDirective {
    private element?: ActionHandlerElement;
    private options: ActionHandlerOptions = {};
    private listeners?: AbortController;
    private holdTimer?: ReturnType<typeof setTimeout>;
    private tapTimer?: ReturnType<typeof setTimeout>;
    private held = false;
    private cancelled = false;
    private pressed = false;

    update(part: AttributePart, [options = {}]: DirectiveParameters<this>) {
        if (this.options.hasHold !== options.hasHold || this.options.hasDoubleClick !== options.hasDoubleClick) {
            this.clearTimers();
            this.held = false;
        }
        this.options = options;
        this.element = part.element as ActionHandlerElement;
        if (this.isConnected && !this.listeners) this.bind();
        return noChange;
    }

    render(_options?: ActionHandlerOptions) { return noChange; }

    private owns(ev: Event): boolean {
        for (const target of ev.composedPath()) {
            if (target === this.element) return true;
            if (target instanceof HTMLElement && (
                (target as ActionHandlerElement).actionHandler ||
                target.matches('button, input, select, textarea, a[href], [role="button"], [role="switch"], ha-entity-toggle')
            )) return false;
        }
        return false;
    }

    private emit(action: string): void {
        if (this.element?.isConnected) fireEvent(this.element, 'action', { action });
    }

    private clearTimers(): void {
        clearTimeout(this.holdTimer);
        clearTimeout(this.tapTimer);
        this.holdTimer = undefined;
        this.tapTimer = undefined;
    }

    private cancel = (): void => {
        if (this.pressed) this.cancelled = true;
        this.pressed = false;
        this.held = false;
        this.clearTimers();
    };

    private bind(): void {
        const element = this.element!;
        this.listeners = new AbortController();
        const options = { signal: this.listeners.signal };
        element.actionHandler = true;
        if (element.tabIndex < 0) element.tabIndex = 0;
        if (!element.hasAttribute('role')) element.setAttribute('role', 'button');

        element.addEventListener('pointerdown', (ev) => {
            if (!this.owns(ev) || ev.button !== 0 || ev.isPrimary === false) return;
            this.pressed = true;
            this.cancelled = false;
            this.held = false;
            clearTimeout(this.holdTimer);
            if (this.options.hasHold) {
                this.holdTimer = setTimeout(() => { this.held = true; }, 500);
            }
        }, options);
        element.addEventListener('pointerup', (ev) => {
            if (!this.owns(ev)) return;
            clearTimeout(this.holdTimer);
            this.pressed = false;
        }, options);
        element.addEventListener('pointercancel', this.cancel, options);
        element.addEventListener('pointerleave', () => { if (this.pressed) this.cancel(); }, options);
        element.addEventListener('click', (ev) => {
            if (!this.owns(ev)) return;
            ev.preventDefault();
            if (this.cancelled) { this.cancelled = false; return; }
            if (this.held && this.options.hasHold) {
                this.clearTimers();
                this.held = false;
                this.emit('hold');
            } else if (this.options.hasDoubleClick) {
                if (this.tapTimer !== undefined) {
                    clearTimeout(this.tapTimer);
                    this.tapTimer = undefined;
                    this.emit('double_tap');
                } else {
                    this.tapTimer = setTimeout(() => {
                        this.tapTimer = undefined;
                        this.emit('tap');
                    }, 250);
                }
            } else this.emit('tap');
        }, options);
        element.addEventListener('contextmenu', (ev) => {
            if (this.owns(ev) && this.options.hasHold) ev.preventDefault();
        }, options);
        element.addEventListener('keydown', (ev) => {
            if (this.owns(ev) && ['Enter', ' '].includes(ev.key)) ev.preventDefault();
        }, options);
        element.addEventListener('keyup', (ev) => {
            if (!this.owns(ev) || !['Enter', ' '].includes(ev.key)) return;
            ev.preventDefault();
            this.cancel();
            this.emit('tap');
        }, options);
        window.addEventListener('blur', this.cancel, options);
        window.addEventListener('scroll', this.cancel, { ...options, capture: true, passive: true });
    }

    protected disconnected(): void {
        this.cancel();
        this.listeners?.abort();
        this.listeners = undefined;
    }

    protected reconnected(): void { this.bind(); }
}

export const actionHandler = directive(ActionHandlerDirective);
