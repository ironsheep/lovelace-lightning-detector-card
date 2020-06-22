import { LitElement, html, customElement, property, CSSResult, TemplateResult, css, PropertyValues } from 'lit-element';
import {
  HomeAssistant,
  hasConfigOrEntityChanged,
  hasAction,
  ActionHandlerEvent,
  handleAction,
  LovelaceCardEditor,
  getLovelace,
  LovelaceCard,
} from 'custom-card-helpers';

import './editor';

import { LightningDetectorCardConfig } from './types';
import { actionHandler } from './action-handler-directive';
import { CARD_VERSION } from './const';

import { localize } from './localize/localize';

/* eslint no-console: 0 */
console.info(
  `%c  LIGHTNING-DETECTOR-CARD \n%c  ${localize('common.version')} ${CARD_VERSION}    `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'lightning-detector-card',
  name: 'Lightning Detector Card',
  description: 'A card for displaying lightning in the local area as detected by an AS3935 sensor',
});

// TODO Name your custom element
@customElement('lightning-detector-card')
export class LightningDetectorCard extends LitElement {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('lightning-detector-card-editor') as LovelaceCardEditor;
  }

  public static getStubConfig(): object {
    return {};
  }

  // TODO Add any properities that should cause your element to re-render here
  @property() public hass!: HomeAssistant;
  @property() private _config!: LightningDetectorCardConfig;

  public setConfig(config: LightningDetectorCardConfig): void {
    // TODO Check for required fields and that they are of the proper format
    if (!config || config.show_error) {
      throw new Error(localize('common.invalid_configuration'));
    }

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    this._config = {
      name: 'LightningDetector',
      ...config,
    };
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    return hasConfigOrEntityChanged(this, changedProps, false);
  }

  protected render(): TemplateResult | void {
    // TODO Check for stateObj or other necessary things and render a warning if missing
    if (this._config.show_warning) {
      return this.showWarning(localize('common.show_warning'));
    }

    return html`
      <ha-card
        .header=${this._config.name}
        @action=${this._handleAction}
        .actionHandler=${actionHandler({
          hasHold: hasAction(this._config.hold_action),
          hasDoubleClick: hasAction(this._config.double_tap_action),
        })}
        tabindex="0"
        aria-label=${`LightningDetector: ${this._config.entity}`}
      >
        <div class="container">
          <svg class="panel" viewBox="0 0 10 10" width="100%">
            <circle
              class="high"
              cx="5"
              cy="5"
              r="4"
              stroke="#8c8c8c"
              stroke-dasharray="0 0.1"
              stroke-width="0.03"
              stroke-linecap="round"
            />
            <circle
              class="medium"
              cx="5"
              cy="5"
              r="3.3"
              stroke="#8c8c8c"
              stroke-dasharray="0 0.1"
              stroke-width="0.03"
              stroke-linecap="round"
            />
            <circle
              class="low"
              cx="5"
              cy="5"
              r="2.7"
              stroke="#8c8c8c"
              stroke-dasharray="0 0.1"
              stroke-width="0.03"
              stroke-linecap="round"
            />
            <circle
              class="none"
              cx="5"
              cy="5"
              r="2.0"
              stroke="#8c8c8c"
              stroke-dasharray="0 0.1"
              stroke-width="0.03"
              stroke-linecap="round"
            />
            <circle
              class="none"
              cx="5"
              cy="5"
              r="1.3"
              stroke="#8c8c8c"
              stroke-dasharray="0 0.1"
              stroke-width="0.03"
              stroke-linecap="round"
            />
            <circle
              class="none"
              cx="5"
              cy="5"
              r="0.7"
              stroke="#8c8c8c"
              stroke-dasharray="0 0.1"
              stroke-width="0.03"
              stroke-linecap="round"
            />
          </svg>

          <div class="status-text">Lightning: 11-25+ mi</div>
          <div class="interp-text">
            2 detections, max power 5k<br />
            8 detections, max power 5k<br />
            25 detections, max power 200k
          </div>
          <div class="ring5-dist label-dark">21-25 mi</div>
          <div class="ring4-dist label-dark">16-20 mi</div>
          <div class="ring3-dist label-dark">11-15 mi</div>
          <div class="ring2-dist label-light">6-10 mi</div>
          <div class="ring1-dist label-light">2-5 mi</div>
          <div class="distance-label legend-light">Distance</div>

          <div class="detections-label legend-dark">Detections</div>
          <div class="ring0 centered label-light">Overhead</div>
          <div class="ring5-det legend-dark">25</div>
          <div class="ring4-det legend-dark">8</div>
          <div class="ring3-det legend-dark">2</div>
        </div>
      </ha-card>
    `;
  }

  private _handleAction(ev: ActionHandlerEvent): void {
    if (this.hass && this._config && ev.detail.action) {
      handleAction(this, this.hass, this._config, ev.detail.action);
    }
  }

  private showWarning(warning: string): TemplateResult {
    return html`
      <hui-warning>${warning}</hui-warning>
    `;
  }

  private showError(error: string): TemplateResult {
    const errorCard = document.createElement('hui-error-card') as LovelaceCard;
    errorCard.setConfig({
      type: 'error',
      error,
      origConfig: this._config,
    });

    return html`
      ${errorCard}
    `;
  }

  static get styles(): CSSResult {
    return css`
      :host ha-card {
        padding: 10px 10px 10px 10px;
      }

      .low {
        fill: #d3d29b;
      }
      .medium {
        fill: #d49e66;
      }
      .high {
        fill: #d45f62;
      }
      .none {
        fill: #252629;
      }
      .panel {
        background-color: #252629;
      }
      body {
        background-color: #fff;
      }
      /* Container holding the image and the text */
      .container {
        position: relative;
        text-align: center;
        color: white;
      }

      /* Bottom left text */
      .bottom-left {
        position: absolute;
        bottom: 8px;
        left: 16px;
      }

      /* Top left text */
      .top-left {
        position: absolute;
        top: 8px;
        left: 16px;
      }

      /* Top right text */
      .top-right {
        position: absolute;
        top: 8px;
        right: 16px;
      }

      /* Bottom right text */
      .bottom-right {
        position: absolute;
        bottom: 8px;
        right: 16px;
      }

      .status-text {
        position: absolute;
        top: 35px;
        right: 40px;
        font-family: Arial, Helvetica, sans-serif;
        font-style: normal;
        font-weight: bold;
        font-size: 27px;
        color: #8c8c8c;
      }

      .interp-text {
        position: absolute;
        top: 35px;
        left: 40px;
        font-family: Arial, Helvetica, sans-serif;
        font-style: normal;
        font-weight: bold;
        font-size: 14px;
        color: #8c8c8c;
        text-align: right;
      }

      /* Centered text */
      .centered {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      /* bottom centered on ring */
      .ring5-dist {
        position: absolute;
        bottom: 12%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .ring4-dist {
        position: absolute;
        bottom: 18.5%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .ring3-dist {
        position: absolute;
        bottom: 25%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .ring2-dist {
        position: absolute;
        bottom: 32%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .ring1-dist {
        position: absolute;
        bottom: 39%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      /* bottom center */
      .distance-label {
        position: absolute;
        bottom: 6.5%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .label-dark {
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
      }

      .label-light {
        color: #bdc1c6;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
      }

      .legend-dark {
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 15px;
        font-weight: bold;
      }

      .legend-light {
        color: #bdc1c6;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 15px;
        font-weight: bold;
      }

      .ring5-det {
        position: absolute;
        bottom: 50%;
        left: 14%;
        transform: translate(-50%, -50%);
      }

      .ring4-det {
        position: absolute;
        bottom: 50%;
        left: 20%;
        transform: translate(-50%, -50%);
      }

      .ring3-det {
        position: absolute;
        bottom: 50%;
        left: 27%;
        transform: translate(-50%, -50%);
      }

      /* bottom center */
      .detections-label {
        position: absolute;
        top: 46%;
        left: 20%;
        transform: translate(-50%, -50%);
      }
    `;
  }
}
