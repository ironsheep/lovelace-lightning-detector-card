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
  relativeTime,
  computeStateDisplay,
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

    //   const stateObj = this._config.entity ? this.hass.states[this._config.entity] : undefined;
    //   console.log('- stateObj:');
    //   console.log(stateObj);

    if (!config.light_color) {
      this._config.light_color = 'ffff00'; // yellow
    }
    if (!config.medium_color) {
      this._config.medium_color = 'ff8000'; // orange
    }
    if (!config.heavy_color) {
      this._config.heavy_color = 'ff0000'; // red
    }

    if (!config.background_color) {
      this._config.background_color = 'var(--paper-card-background-color)';
    }
    if (!config.light_text_color) {
      this._config.light_text_color = 'bdc1c6';
    }
    if (!config.dark_text_color) {
      this._config.dark_text_color = '000000';
    }

    console.log('- config:');
    console.log(this._config);
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stateStrInterp = computeStateDisplay(this.hass?.localize, stateObj!, this.hass?.language);

    let needRingsGeneration = false;

    if (this._firstTime) {
      console.log('- stateObj:');
      console.log(stateObj);

      // set initial config values from entity, too
      this._config.units = stateObj?.attributes['units'];
      this._config.ring_count = stateObj?.attributes['ring_count'];
      this._config.ring_width = stateObj?.attributes['ring_width'];
      this._config.out_of_range_count = stateObj?.attributes['outofrange'];
      this._config.period_in_minutes = stateObj?.attributes['period_minutes'];

      needRingsGeneration = true;

      console.log('- post rings _config:');
      console.log(this._config);
      this._firstTime = false;
    }

    // logic
    //  if rings change re-layout rings
    const new_ring_count = stateObj?.attributes['ring_count'];
    if (new_ring_count != this._config.ring_count) {
      needRingsGeneration = true;
    }

    if (needRingsGeneration) {
      // update config values from entity, too
      this._config.units = stateObj?.attributes['units'];
      this._config.ring_count = stateObj?.attributes['ring_count'];
      this._config.ring_width = stateObj?.attributes['ring_width'];

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ring_count: number = this._config.ring_count!;
      this._config.ringsImage = this._createRings(ring_count);
      this._config.ringsLegend = this._createRingsLegend(ring_count);
      this._config.ringsTitles = this._createRingLabels(ring_count);
      this._config.cardText = this._createCardText(ring_count);

      console.log('ringsImage:');
      console.log(this._config.ringsImage);
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
          <div class="rings">${this._config.ringsImage} ${this._config.ringsLegend} ${this._config.ringsTitles}</div>
          ${this._config.cardText}
        </div>
        <div class="last-heard legend-light">Last report: ${stateStrInterp}!</div>
      </ha-card>
    `;
  }

  private _ringDictionary(ring_index: number): object {
    const stateObj = this._config.entity ? this.hass.states[this._config.entity] : undefined;
    const ring_key: string = 'ring' + ring_index;
    let ringDictionary: object = {};
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (ring_key in stateObj?.attributes!) {
      ringDictionary = stateObj?.attributes[ring_key];
    }
    return ringDictionary;
  }

  private _circle(ring_index: number, ring_count: number, color_class: string): TemplateResult {
    const total_segment_widths = ring_count * 2 + 5;
    const ring_diameter = ring_index * 2 + 2;
    const diameter_percent = ring_diameter / total_segment_widths;
    const radius = diameter_percent * ring_count;
    return html`
      <circle
        class="${color_class}"
        cx="5"
        cy="5"
        r="${radius}"
        stroke="#8c8c8c"
        stroke-dasharray="0 0.1"
        stroke-width="0.03"
        stroke-linecap="round"
      ></circle>
    `;
  }

  private _ringColorClass(ring_index: number): string {
    const energy_key: string = 'energy';
    const strike_count_key: string = 'count';
    const ringDictionary = this._ringDictionary(ring_index);
    // color class
    //   high-detections, medium-detections, low-detections, no-detections
    //   high-power, medium-power, low-power, no-power
    const count: number = ringDictionary[strike_count_key];
    const energy: number = ringDictionary[energy_key];
    // encode our detectins count
    let colorCountClass: string = 'no-detections';
    if (count > 10) {
      colorCountClass = 'high-detections';
    } else if (count > 3) {
      colorCountClass = 'medium-detections';
    } else if (count > 0) {
      colorCountClass = 'low-detections';
    }
    // encode our energy level
    let colorEnergyClass: string = 'no-power';
    if (energy > 10) {
      colorEnergyClass = 'high-power';
    } else if (energy > 3) {
      colorEnergyClass = 'medium-power';
    } else if (energy > 0) {
      colorEnergyClass = 'low-power';
    }
    // combine the two and return the new class
    const colorClass = colorCountClass + ' ' + colorEnergyClass;
    return colorClass;
  }

  private _createRings_new(ring_count: number): TemplateResult {
    const ringArray: TemplateResult[] = [];
    for (let ring_index = 0; ring_index <= ring_count; ring_index++) {
      const ringColorClass: string = this._ringColorClass(ring_index);
      const circleHTML: TemplateResult = this._circle(ring_index, ring_count, ringColorClass);
      //console.log('- ring circle:');
      //console.log(circleHTML);
      ringArray.push(circleHTML);
    }

    //console.log('- ring circle-set:');
    //console.log(ringArray);

    const svgHTML: TemplateResult = html`
      <svg class="graphics" viewBox="0 0 10 10" width="100%">
        ${ringArray}
      </svg>
    `;

    //console.log('- svgHTML:');
    //console.log(svgHTML);

    return svgHTML;
  }

  private _createRings(ring_count: number): TemplateResult {
    for (let ringIdx = 0; ringIdx <= ring_count; ringIdx++) {}
    return html`
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
    `;
  }

  private _createRingsLegend(ring_count: number): TemplateResult {
    for (let ringIdx = 0; ringIdx <= ring_count; ringIdx++) {}
    return html`
      <div class="distance-label legend-light">Distance</div>
      <div class="detections-label legend-light rotate">Detections</div>
      <div class="ring5-dist label-dark">21-25 mi</div>
      <div class="ring4-dist label-dark">16-20 mi</div>
      <div class="ring3-dist label-dark">11-15 mi</div>
      <div class="ring2-dist label-light">6-10 mi</div>
      <div class="ring1-dist label-light">2-5 mi</div>
      <div class="ring0 centered label-light">Overhead</div>
    `;
  }

  private _createRingLabels(ring_count: number): TemplateResult {
    for (let ringIdx = 0; ringIdx <= ring_count; ringIdx++) {}
    return html`
      <div class="ring5-det legend-dark">25</div>
      <div class="ring4-det legend-dark">08</div>
      <div class="ring3-det legend-dark">02</div>
      <div class="ring2-det legend-light">00</div>
      <div class="ring1-det legend-light">00</div>
      <div class="ring0-det legend-light">00</div>
    `;
  }

  private _createCardText(ring_count: number): TemplateResult {
    for (let ringIdx = 0; ringIdx <= ring_count; ringIdx++) {}
    return html`
      <div class="status-text">Lightning: 11-25+ mi</div>
      <div class="interp-text">
        2 detections, max power 5k<br />
        8 detections, max power 5k<br />
        25 detections, max power 200k
      </div>
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
        /*background-color: violet;*/
      }
      div {
        /*background-color: red;*/
      }
      .graphics {
        /*background-color: orange;*/
        margin: 0px;
        padding: 0px;
      }
      .card-content {
        padding: 80px 0px 0px 0px; /* NOTE: we add +16 to top pad so we have space at top of card when no-name! */
        margin: 0px 0px 0px 0px; /* NOTE: top should be -16 if name is present */
        display: block;
        /*background-color: yellow;*/
        position: relative; /* ensure descendant abs-objects are relative this? */
      }
      .rings {
        /*background-color: green;*/
        /*padding: 0px;*/
        position: relative; /* ensure descendant abs-objects are relative this? */
        margin: 0px;
        padding: 0px;
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
      .high-detections.high-power {
        fill: #d45f62;
      }
      .no-detections.no-power {
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
        left: 13.5%;
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
        left: 26.75%;
        transform: translate(-50%, -50%);
      }

      .ring2-det {
        position: absolute;
        top: 50%;
        left: 33.5%;
        transform: translate(-50%, -50%);
      }

      .ring1-det {
        position: absolute;
        top: 50%;
        left: 40%;
        transform: translate(-50%, -50%);
      }

      .ring0-det {
        position: absolute;
        top: 46%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
    `;
  }

  private _computeRingColor(energy: number, detections: number): string {
    //const config = this._config;
    if (energy || detections) {
    }
    // energy 4 levels (none, yellow, orange, red)
    // count 4 levels (none, low, medium, high)
    // locate our base color from config
    // change it to HSL from RGB
    //  set saturation according to detections
    //  set brightnes according to energy
    //  return new HSL color
    const ringColor = 'ff0000';
    //if (config.severity) {
    //  //barColor = this._computeSeverityColor(value, index);
    //} else if (value == 'unavailable') {
    //  barColor = `var(--bar-card-disabled-color, ${config.color})`;
    //} else {
    //  barColor = config.color;
    //}
    return ringColor;
  }
}
