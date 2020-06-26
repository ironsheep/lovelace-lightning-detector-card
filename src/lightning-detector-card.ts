/* eslint-disable @typescript-eslint/no-inferrable-types */
import { LitElement, html, customElement, property, CSSResult, TemplateResult, css, PropertyValues } from 'lit-element';
// found custom-card-helpers:applyThemesOnElement being imported in roku-card... not here.  Useful? */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).customCards = (window as any).customCards || [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).customCards.push({
  type: 'lightning-detector-card',
  name: 'Lightning Detector Card',
  description: 'A card for displaying lightning in the local area as detected by an AS3935 sensor',
});

//  Name of our custom element
@customElement('lightning-detector-card')
export class LightningDetectorCard extends LitElement {
  //public static async getConfigElement(): Promise<LovelaceCardEditor> {
  //  return document.createElement('lightning-detector-card-editor') as LovelaceCardEditor;
  //}

  //public static getStubConfig(): object {
  //  return {};
  //}

  // TODO Add any properities that should cause your element to re-render here
  @property() private hass!: HomeAssistant;
  @property() private _config!: LightningDetectorCardConfig;
  @property() private _firstTime: boolean = true;

  private _light_color?: string;
  private _medium_color?: string;
  private _heavy_color?: string;

  public setConfig(config: LightningDetectorCardConfig): void {
    // TODO Check for required fields and that they are of the proper format
    if (!config || config.show_error) {
      throw new Error(localize('common.invalid_configuration'));
    }
    if (!config.entity) {
      console.log("Invalid configuration. If no entity provided, you'll need to provide a remote entity");
      throw new Error('You need to associate an entity');
    }

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    this._config = {
      name: undefined,
      ...config,
    };

    console.log('- config:');
    console.log(this._config);

    //   const stateObj = this._config.entity ? this.hass.states[this._config.entity] : undefined;
    //   console.log('- stateObj:');
    //   console.log(stateObj);
  }

  // The height this card.  Home Assistant uses this to automatically
  // distribute all cards over the available columns.
  //public getCardSize(): number {
  //  return 5;
  //}

  //protected shouldUpdate(changedProps: PropertyValues): boolean {
  //  return hasConfigOrEntityChanged(this, changedProps, false);
  //}

  protected render(): TemplateResult | void {
    // TODO Check for stateObj or other necessary things and render a warning if missing
    if (this._config.show_warning) {
      return this.showWarning(localize('common.show_warning'));
    }

    const entityId = this._config.entity ? this._config.entity : undefined;
    const stateObj = this._config.entity ? this.hass.states[this._config.entity] : undefined;

    if (!entityId && !stateObj) {
      return this.showWarning('Entity Unavailable');
    }

    const stateStr = stateObj ? stateObj.state : 'unavailable';

    if (this._firstTime) {
      console.log('- stateObj:');
      console.log(stateObj);
      this._firstTime = false;
    }

    return html`
      <ha-card
        .header=${this._config.name}
        @action=${this._handleAction}
        .actionHandler=${actionHandler({
          hasHold: hasAction(this._config.hold_action),
          hasDoubleClick: hasAction(this._config.double_tap_action),
        })}
      >
        <div class="card-content">
          <div class="rings">
            <svg class="graphics" viewBox="0 0 10 10" width="100%">
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
            <div class="distance-label legend-light">Distance</div>
            <div class="detections-label legend-light rotate">Detections</div>
            <div class="ring5-dist label-dark">21-25 mi</div>
            <div class="ring4-dist label-dark">16-20 mi</div>
            <div class="ring3-dist label-dark">11-15 mi</div>
            <div class="ring2-dist label-light">6-10 mi</div>
            <div class="ring1-dist label-light">2-5 mi</div>
            <div class="ring0 centered label-light">Overhead</div>
            <div class="ring5-det legend-dark">25</div>
            <div class="ring4-det legend-dark">8</div>
            <div class="ring3-det legend-dark">2</div>
          </div>

          <div class="status-text">Lightning: 11-25+ mi</div>
          <div class="interp-text">
            2 detections, max power 5k<br />
            8 detections, max power 5k<br />
            25 detections, max power 200k
          </div>
        </div>
        <div class="last-heard legend-light">The state is ${stateStr}!</div>
      </ha-card>
    `;
  }

  private _text_hold(error: string): TemplateResult {
    const errorCard = document.createElement('hui-error-card') as LovelaceCard;
    errorCard.setConfig({
      type: 'error',
      error,
      origConfig: this._config,
    });

    return html`
      <ha-card .header=${this._config.name}> </ha-card>
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
      ha-card {
        background-color: violet;
      }
      div {
        /*background-color: red;*/
      }
      .graphics {
        /*background-color: orange;*/
      }
      .card-content {
        padding: 80px 0px 0px 0px; /* NOTE: we add +16 to top pad so we have space at top of card when no-name! */
        margin: 0px 0px 0px 0px; /* NOTE: top should be -16 if name is present */
        display: block;
        background-color: yellow;
        position: relative; /* ensure descendant abs-objects are relative this? */
      }
      .rings {
        background-color: green;
        /*padding: 0px;*/
        position: relative; /* ensure descendant abs-objects are relative this? */
      }
      .rotate {
        writing-mode: vertical-rl;
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
        top: 8px;
        right: 16px;
      }

      .status-text {
        position: absolute;
        top: 16px;
        right: 10px;
        /* font-family: Arial, Helvetica, sans-serif; */
        font-style: normal;
        font-weight: bold;
        font-size: 14px;
        line-height: 14px;
        /* color: #8c8c8c; */
      }

      .interp-text {
        position: absolute;
        top: 30px;
        left: 10px;
        /* font-family: Arial, Helvetica, sans-serif; */
        font-style: normal;
        font-weight: bold;
        font-size: 10px;
        line-height: 13px;
        /* color: #8c8c8c; */
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
        bottom: 9%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .ring4-dist {
        position: absolute;
        bottom: 15%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .ring3-dist {
        position: absolute;
        bottom: 22%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .ring2-dist {
        position: absolute;
        bottom: 29%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .ring1-dist {
        position: absolute;
        bottom: 35.5%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      /* bottom center */
      .distance-label {
        position: absolute;
        bottom: 2%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      /* left just-above-center */
      .detections-label {
        position: absolute;
        top: 50%;
        left: 5%;
        transform: translate(-50%, -50%);
      }

      .label-dark {
        color: #000;
        /* font-family: Arial, Helvetica, sans-serif; */
        font-size: 9px;
      }

      .label-light {
        color: #bdc1c6;
        /* font-family: Arial, Helvetica, sans-serif; */
        font-size: 9px;
      }

      .legend-dark {
        color: #000;
        /* font-family: Arial, Helvetica, sans-serif; */
        font-size: 10px;
        font-weight: bold;
      }

      .legend-light {
        color: #bdc1c6;
        /* font-family: Arial, Helvetica, sans-serif; */
        font-size: 10px;
        font-weight: bold;
      }

      .ring5-det {
        position: absolute;
        top: 50%;
        left: 14%;
        transform: translate(-50%, -50%);
      }

      .ring4-det {
        position: absolute;
        top: 50%;
        left: 20%;
        transform: translate(-50%, -50%);
      }

      .ring3-det {
        position: absolute;
        top: 50%;
        left: 27%;
        transform: translate(-50%, -50%);
      }
    `;
  }
}
