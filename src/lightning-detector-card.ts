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
  applyThemesOnElement,
} from 'custom-card-helpers';
import {
  getFontColorBasedOnBackgroundColor,
  applyBrightnessToColor,
  getLightColorBasedOnTemperature,
} from './color_helpers';
import './editor';

import { LightningDetectorCardConfig } from './types';
import { actionHandler } from './action-handler-directive';
import * as Constants from './const';

import { localize } from './localize/localize';

/* eslint no-console: 0 */
console.info(
  `%c  LIGHTNING-DETECTOR-CARD \n%c  ${localize('common.version')} ${Constants.CARD_VERSION}    `,
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
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('lightning-detector-card-editor') as LovelaceCardEditor;
  }

  public static getStubConfig(): object {
    return {};
  }

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
      this._config.light_color = 'd3d29b'; // yellow
    }
    if (!config.medium_color) {
      this._config.medium_color = 'd49e66'; // orange
    }
    if (!config.heavy_color) {
      this._config.heavy_color = 'd45f62'; // red
    }
    if (!config.ring_no_color) {
      this._config.ring_no_color = '252629'; // light black?
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

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('_config')) {
      return true;
    }

    if (this.hass && this._config) {
      const oldHass = changedProps.get('hass') as HomeAssistant | undefined;

      if (oldHass) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return oldHass.states[this._config.entity!] !== this.hass.states[this._config.entity!];
      }
    }

    return true;
  }

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

    //const stateStr = stateObj ? stateObj.state : 'unavailable';
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stateStrInterp = computeStateDisplay(this.hass?.localize, stateObj!, this.hass?.language);
    const relativeInterp =
      stateStrInterp === undefined ? '{unknown}' : relativeTime(new Date(stateStrInterp), this.hass?.localize);

    let needRingsGeneration = false;

    if (this._firstTime) {
      console.log('- stateObj:');
      console.log(stateObj);

      // set timer so our card updates timestamp every 5 seconds
      // FIXME: UNDONE remember to clear this interval when entity NOT avail. and restore when comes avail again...
      setInterval(() => this._updateTime(), 5000);

      // set initial config values from entity, too
      this._config.units = stateObj?.attributes[Constants.RINGSET_UNITS_KEY];
      this._config.ring_count = stateObj?.attributes[Constants.RINGSET_RING_COUNT_KEY];
      this._config.ring_width = stateObj?.attributes[Constants.RINGSET_RING_WIDTH_KM_KEY];
      this._config.out_of_range_count = stateObj?.attributes[Constants.RINGSET_OUT_OF_RANGE_KEY];
      this._config.period_in_minutes = stateObj?.attributes[Constants.RINGSET_PERIOD_MINUTES_KEY];

      needRingsGeneration = true;

      console.log('- post rings _config:');
      console.log(this._config);
      this._firstTime = false;
    }

    // logic
    //  if rings change re-layout rings
    const new_ring_count = stateObj?.attributes[Constants.RINGSET_RING_COUNT_KEY];
    if (new_ring_count != this._config.ring_count) {
      needRingsGeneration = true;
    }
    const new_units = stateObj?.attributes[Constants.RINGSET_UNITS_KEY];
    if (new_units != this._config.units) {
      needRingsGeneration = true;
    }

    if (needRingsGeneration) {
      // update config values from entity, too
      this._config.units = stateObj?.attributes[Constants.RINGSET_UNITS_KEY];
      this._config.ring_count = stateObj?.attributes[Constants.RINGSET_RING_COUNT_KEY];
      this._config.ring_width = stateObj?.attributes[Constants.RINGSET_RING_WIDTH_KM_KEY];

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
        <div id="lightning-timestamp" class="last-heard legend-light">Last report: ${relativeInterp}!</div>
      </ha-card>
    `;
  }

  // Here we need to refresh the rings and titles after it has been initially rendered
  protected updated(changedProps): void {
    if (!this._config) {
      return;
    }

    // update cards' theme if changed
    if (this.hass) {
      const oldHass = changedProps.get('hass');
      if (!oldHass || oldHass.themes !== this.hass.themes) {
        applyThemesOnElement(this, this.hass.themes, this._config.theme);
      }
    }

    const root: any = this.shadowRoot;

    // update card labels
    //
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const statusLabel: string = this._calcCardStatusText(this._config.ring_count!);
    let labelElement = root.getElementById('card-status');
    labelElement.textContent = statusLabel;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const interpLabels: string[] = this._calcCardDetailText(this._config.ring_count!);
    labelElement = root.getElementById('card-detail');
    labelElement.textContent = interpLabels.join('\r\n'); // in HTML would be </ br>

    // update card content
    //
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (let ring_index = 0; ring_index <= this._config.ring_count!; ring_index++) {
      // adjust ring detections count and color
      let label_id = this._countLabelIdFromRingIndex(ring_index);
      const currRingDictionary = this._ringDictionary(ring_index);
      const currCount = currRingDictionary[Constants.RING_COUNT_KEY];
      let labelElement = root.getElementById(label_id);
      labelElement.textContent = currCount;
      const currTextColor = currCount > 0 ? this._config.dark_text_color : this._config.light_text_color;
      labelElement.style.setProperty('color', currTextColor);
      // adjust ring distances color
      label_id = this._distanceLabelIdFromRingIndex(ring_index);
      labelElement = root.getElementById(label_id);
      labelElement.style.setProperty('color', currTextColor);
      // adjust ring color
      const ring_id = this._ringIdFromRingIndex(ring_index);
      const currEnergy = currRingDictionary[Constants.RING_ENERGY_KEY];
      const ringElement = root.getElementById(ring_id);
      const currRingColor = this._computeRingColor(currEnergy, currCount);
      ringElement.style.setProperty('fill', currRingColor);
    }
  }

  private _updateTime(): void {
    // call when time to refresh our card's relative time for last report
    const root: any = this.shadowRoot;
    const labelElement = root.getElementById('lightning-timestamp');
    const stateObj = this._config.entity ? this.hass.states[this._config.entity] : undefined;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stateStrInterp = computeStateDisplay(this.hass?.localize, stateObj!, this.hass?.language);
    const relativeInterp =
      stateStrInterp === undefined ? '{unknown}' : relativeTime(new Date(stateStrInterp), this.hass?.localize);
    const newLabel = 'Last report: ' + relativeInterp;
    labelElement.textContent = newLabel;
  }

  private _ringsEntry(key: string): string {
    const stateObj = this._config.entity ? this.hass.states[this._config.entity] : undefined;
    let ring_value: string = '';
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (key in stateObj?.attributes!) {
      ring_value = stateObj?.attributes[key];
    }
    return ring_value;
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

  private _ringColorClass(ring_index: number): string {
    const ringDictionary = this._ringDictionary(ring_index);
    // color class
    //   high-detections, medium-detections, low-detections, no-detections
    //   high-power, medium-power, low-power, no-power
    const count: number = ringDictionary[Constants.RING_COUNT_KEY];
    const energy: number = ringDictionary[Constants.RING_ENERGY_KEY];
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

  private _circleRadius(ring_index: number, ring_count: number): string {
    const total_segment_widths = ring_count * 2 + 2; // +2 for center - total widths are...
    const ring_diameter = ring_index * 2 + 2; // and this ring dia is...
    const diameter_percent = (ring_diameter / total_segment_widths) * 0.85; // 0.85 = 85% of width
    const radius = diameter_percent * 5; // scale to 10 units of width (radius = 5)
    return radius.toFixed(1);
  }

  private _ringIdFromRingIndex(ring_index: number): string {
    // return the ID for a given ring
    return 'ring' + ring_index;
  }

  // WARING: ABOVE and BELOW ring ID values must be consistant!

  private _createRings(ring_count: number): TemplateResult[] {
    const svgArray: TemplateResult[] = [];
    const ringClassArray: string[] = [];
    const ringRadiusArray: string[] = [];
    for (let ring_index = 0; ring_index <= ring_count; ring_index++) {
      const ringColorClass: string = this._ringColorClass(ring_index);
      ringClassArray.push(ringColorClass);
      const ringRadius: string = this._circleRadius(ring_index, ring_count);
      ringRadiusArray.push(ringRadius);
    }

    switch (ring_count) {
      case 7:
        // code block - 7 rings
        svgArray.push(html`
          <svg class="graphics" viewBox="0 0 10 10" width="100%">
            <circle id="ring7" class="${ringClassArray[7]}" cx="5" cy="5" r="${ringRadiusArray[7]}" />
            <circle id="ring6" class="${ringClassArray[6]}" cx="5" cy="5" r="${ringRadiusArray[6]}" />
            <circle id="ring5" class="${ringClassArray[5]}" cx="5" cy="5" r="${ringRadiusArray[5]}" />
            <circle id="ring4" class="${ringClassArray[4]}" cx="5" cy="5" r="${ringRadiusArray[4]}" />
            <circle id="ring3" class="${ringClassArray[3]}" cx="5" cy="5" r="${ringRadiusArray[3]}" />
            <circle id="ring2" class="${ringClassArray[2]}" cx="5" cy="5" r="${ringRadiusArray[2]}" />
            <circle id="ring1" class="${ringClassArray[1]}" cx="5" cy="5" r="${ringRadiusArray[1]}" />
            <circle id="ring0" class="${ringClassArray[0]}" cx="5" cy="5" r="${ringRadiusArray[0]}" />
          </svg>
        `);
        break;
      case 6:
        // code block - 6 rings
        svgArray.push(html`
          <svg class="graphics" viewBox="0 0 10 10" width="100%">
            <circle id="ring7" class="${ringClassArray[6]}" cx="5" cy="5" r="${ringRadiusArray[6]}" />
            <circle id="ring5" class="${ringClassArray[5]}" cx="5" cy="5" r="${ringRadiusArray[5]}" />
            <circle id="ring4" class="${ringClassArray[4]}" cx="5" cy="5" r="${ringRadiusArray[4]}" />
            <circle id="ring3" class="${ringClassArray[3]}" cx="5" cy="5" r="${ringRadiusArray[3]}" />
            <circle id="ring2" class="${ringClassArray[2]}" cx="5" cy="5" r="${ringRadiusArray[2]}" />
            <circle id="ring1" class="${ringClassArray[1]}" cx="5" cy="5" r="${ringRadiusArray[1]}" />
            <circle id="ring0" class="${ringClassArray[0]}" cx="5" cy="5" r="${ringRadiusArray[0]}" />
          </svg>
        `);
        break;
      case 5:
        // code block - 5 rings
        svgArray.push(html`
          <svg class="graphics" viewBox="0 0 10 10" width="100%">
            <circle id="ring5" class="${ringClassArray[5]}" cx="5" cy="5" r="${ringRadiusArray[5]}" />
            <circle id="ring4" class="${ringClassArray[4]}" cx="5" cy="5" r="${ringRadiusArray[4]}" />
            <circle id="ring3" class="${ringClassArray[3]}" cx="5" cy="5" r="${ringRadiusArray[3]}" />
            <circle id="ring2" class="${ringClassArray[2]}" cx="5" cy="5" r="${ringRadiusArray[2]}" />
            <circle id="ring1" class="${ringClassArray[1]}" cx="5" cy="5" r="${ringRadiusArray[1]}" />
            <circle id="ring0" class="${ringClassArray[0]}" cx="5" cy="5" r="${ringRadiusArray[0]}" />
          </svg>
        `);
        break;
      case 4:
        // code block - 4 rings
        svgArray.push(html`
          <svg class="graphics" viewBox="0 0 10 10" width="100%">
            <circle id="ring4" class="${ringClassArray[4]}" cx="5" cy="5" r="${ringRadiusArray[4]}" />
            <circle id="ring3" class="${ringClassArray[3]}" cx="5" cy="5" r="${ringRadiusArray[3]}" />
            <circle id="ring2" class="${ringClassArray[2]}" cx="5" cy="5" r="${ringRadiusArray[2]}" />
            <circle id="ring1" class="${ringClassArray[1]}" cx="5" cy="5" r="${ringRadiusArray[1]}" />
            <circle id="ring0" class="${ringClassArray[0]}" cx="5" cy="5" r="${ringRadiusArray[0]}" />
          </svg>
        `);
        break;
      default:
        // code block - assume 3 rings
        svgArray.push(html`
          <svg class="graphics" viewBox="0 0 10 10" width="100%">
            <circle id="ring3" class="${ringClassArray[3]}" cx="5" cy="5" r="${ringRadiusArray[3]}" />
            <circle id="ring2" class="${ringClassArray[2]}" cx="5" cy="5" r="${ringRadiusArray[2]}" />
            <circle id="ring1" class="${ringClassArray[1]}" cx="5" cy="5" r="${ringRadiusArray[1]}" />
            <circle id="ring0" class="${ringClassArray[0]}" cx="5" cy="5" r="${ringRadiusArray[0]}" />
          </svg>
        `);
    }

    return svgArray;
  }

  private _createRingsLegend(ring_count: number): TemplateResult[] {
    const labelsArray: TemplateResult[] = [];
    labelsArray.push(
      html`
        <div class="distance-legend legend-light">Distance</div>
      `,
    );
    labelsArray.push(
      html`
        <div class="detections-legend legend-light rotate">Detections</div>
      `,
    );

    const units_string: string = this._ringsEntry(Constants.RINGSET_UNITS_KEY);
    for (let ring_index = 0; ring_index <= ring_count; ring_index++) {
      const currRingDictionary = this._ringDictionary(ring_index);
      const count = currRingDictionary[Constants.RING_COUNT_KEY];
      const darkness = count == 0 ? 'light' : 'dark';
      const label_darkness: string = 'label-' + darkness;
      if (ring_index > 0) {
        const from_dist = currRingDictionary[Constants.RING_FROM_UNITS_KEY];
        const to_dist = currRingDictionary[Constants.RING_TO_UNITS_KEY];
        const ring_distance_label: string = from_dist + ' - ' + to_dist + ' ' + units_string;
        const ring_class: string = 'ring' + ring_index + '-dist';
        const ring_dist_id: string = this._distanceLabelIdFromRingIndex(ring_index);
        labelsArray.push(html`
          <div id="${ring_dist_id}" class="${ring_class} ${label_darkness}">${ring_distance_label}</div>
        `);
      } else {
        const ring_dist_id: string = this._distanceLabelIdFromRingIndex(0);
        labelsArray.push(
          html`
            <div id="${ring_dist_id}" class="ring0 centered ${label_darkness}">Overhead</div>
          `,
        );
      }
    }
    return labelsArray;
  }

  private _distanceLabelIdFromRingIndex(ring_index: number): string {
    // return the ID for a given ring distanceLabel
    const label_id: string = 'dist-ring' + ring_index + '-id';
    return label_id;
  }

  private _countLabelIdFromRingIndex(ring_index: number): string {
    // return the ID for a given ring detection count Label
    const label_id: string = 'ct-ring' + ring_index + '-id';
    return label_id;
  }

  private _createRingLabels(ring_count: number): TemplateResult[] {
    const labelsArray: TemplateResult[] = [];
    for (let ring_index = 0; ring_index <= ring_count; ring_index++) {
      const currRingDictionary = this._ringDictionary(ring_index);
      const ring_class: string = 'ring' + ring_index + '-det';
      const count = currRingDictionary[Constants.RING_COUNT_KEY];
      const darkness = count == 0 ? 'light' : 'dark';
      const label_darkness: string = 'label-' + darkness;
      const label_ct_id = this._countLabelIdFromRingIndex(ring_index);
      labelsArray.push(html`
        <div id="${label_ct_id}" class="${ring_class} ${label_darkness}">${count}</div>
      `);
    }
    return labelsArray;
  }

  private _calcCardStatusText(ring_count: number): string {
    const kMinNotSet = 999;
    const kMaxNotSet = -1;
    let min_ring_dist = kMinNotSet;
    let max_ring_dist = kMaxNotSet;
    const units_string: string = this._ringsEntry(Constants.RINGSET_UNITS_KEY);
    const out_of_range: number = parseInt(this._ringsEntry(Constants.RINGSET_OUT_OF_RANGE_KEY), 10);
    let total_count = out_of_range;
    for (let ring_index = 0; ring_index <= ring_count; ring_index++) {
      const currRingDictionary = this._ringDictionary(ring_index);
      const count = currRingDictionary[Constants.RING_COUNT_KEY];
      total_count += count;
      if (count > 0) {
        const from_dist = currRingDictionary[Constants.RING_FROM_UNITS_KEY];
        const to_dist = currRingDictionary[Constants.RING_TO_UNITS_KEY];
        if (min_ring_dist == kMinNotSet) {
          min_ring_dist = from_dist;
        }
        if (to_dist > max_ring_dist) {
          max_ring_dist = to_dist;
        }
      }
    }

    let title =
      total_count == 0
        ? 'No Lightning in Area'
        : 'Lightning: ' + min_ring_dist + ' - ' + max_ring_dist + ' ' + units_string;
    if (total_count == out_of_range) {
      title = 'Lightning: out-of-range';
    }
    return title;
  }

  private _calcCardDetailText(ring_count: number): string[] {
    const distancesStringArray: string[] = [];
    const out_of_range: number = parseInt(this._ringsEntry(Constants.RINGSET_OUT_OF_RANGE_KEY), 10);
    if (out_of_range > 0) {
      const interp_label = out_of_range + ' detections, out-of-range';
      distancesStringArray.push(interp_label);
    }
    for (let ring_index = 0; ring_index <= ring_count; ring_index++) {
      const currRingDictionary = this._ringDictionary(ring_index);
      const energy = currRingDictionary[Constants.RING_ENERGY_KEY];
      const count = currRingDictionary[Constants.RING_COUNT_KEY];
      if (count > 0) {
        let max_power_interp = '200k';
        const energy_in_k: number = Math.round(energy / 10000) * 10;
        if (energy_in_k > 5) {
          max_power_interp = energy_in_k + 'k +';
        } else {
          max_power_interp = '< 5k';
        }

        const interp_label = count + ' detections, max power ' + max_power_interp;
        distancesStringArray.push(interp_label);
      }
    }
    return distancesStringArray;
  }

  private _createCardText(ring_count: number): TemplateResult[] {
    const labelsArray: TemplateResult[] = [];
    const distancesHTMLArray: TemplateResult[] = [];
    const statusLabel: string = this._calcCardStatusText(ring_count);
    const interpLabels: string[] = this._calcCardDetailText(ring_count);

    for (let label_index = 0; label_index < interpLabels.length; label_index++) {
      const interp_label = interpLabels[label_index];
      distancesHTMLArray.push(
        html`
          ${interp_label}<br />
        `,
      );
    }

    labelsArray.push(html`
      <div id="card-status" class="status-text">${statusLabel}</div>
    `);
    labelsArray.push(html`
      <div id="card-detail" class="interp-text">
        ${distancesHTMLArray}
      </div>
    `);
    return labelsArray;
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
      circle {
        stroke: #8c8c8c;
        stroke-dasharray: 0 0.1;
        stroke-width: 0.03;
        stroke-linecap: round;
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
      .medium-detections.high-power {
        fill: #d45f62;
      }
      .low-detections.high-power {
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
        font-size: 16px;
        line-height: 19px;
        /* color: #8c8c8c; */
      }

      .interp-text {
        position: absolute;
        top: 30px;
        left: 10px;
        /* font-family: Arial, Helvetica, sans-serif; */
        font-style: normal;
        font-weight: bold;
        font-size: 12px;
        line-height: 15px;
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
      .ring7-dist {
        position: absolute;
        bottom: 7%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      /* bottom centered on ring */
      .ring6-dist {
        position: absolute;
        bottom: 12%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      /* bottom centered on ring */
      .ring5-dist {
        position: absolute;
        bottom: 7.52%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      .ring4-dist {
        position: absolute;
        bottom: 14.64%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      .ring3-dist {
        position: absolute;
        bottom: 21.76%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      .ring2-dist {
        position: absolute;
        bottom: 28.88%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      .ring1-dist {
        position: absolute;
        bottom: 36%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      .ring0-dist {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      /* bottom center */
      .distance-legend {
        position: absolute;
        bottom: 1%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      /* left just-above-center */
      .detections-legend {
        position: absolute;
        top: 50%;
        left: 4%;
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

      .ring7-det {
        position: absolute;
        top: 50%;
        left: 10.5%;
        transform: translate(-50%, -50%);
      }
      .ring6-det {
        position: absolute;
        top: 50%;
        left: 16%;
        transform: translate(-50%, -50%);
      }
      .ring5-det {
        position: absolute;
        top: 50%;
        left: 11.52%;
        transform: translate(-50%, -50%);
      }
      .ring4-det {
        position: absolute;
        top: 50%;
        left: 18.64%;
        transform: translate(-50%, -50%);
      }
      .ring3-det {
        position: absolute;
        top: 50%;
        left: 25.76%;
        transform: translate(-50%, -50%);
      }
      .ring2-det {
        position: absolute;
        top: 50%;
        left: 32.88%;
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

  private _colorForBasePower(color_base: string, power: number): string {
    if (color_base) {
      // kill warnings
    }
    if (power) {
      // kill warnings
    }
    return '';
  }

  private _computeRingColor(energy: number, detections: number): string {
    //const config = this._config;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let ringColor = this._config.ring_no_color!;
    if (energy != 0 && detections != 0) {
      // energy 4 levels (none, yellow, orange, red)
      // count 4 levels (none, low, medium, high)
      // locate our base color from config
      if (detections > 9) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ringColor = this._config.heavy_color!;
      } else if (detections > 3) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ringColor = this._config.medium_color!;
      } else if (detections > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ringColor = this._config.light_color!;
      }
      // change it to HSL from RGB
      //  set saturation according to detections
      //  set brightnes according to energy
      //  return new HSL color
      //if (config.severity) {
      //  //barColor = this._computeSeverityColor(value, index);
      //} else if (value == 'unavailable') {
      //  barColor = `var(--bar-card-disabled-color, ${config.color})`;
      //} else {
      //  barColor = config.color;
      //}
    }
    return ringColor;
  }

  //
  //   FOR REFERENCE:
  //
  private _hexToRBG(hex: string): string {
    let r = '0',
      g = '0',
      b = '0';

    if (hex.length == 4) {
      r = '0x' + hex[1] + hex[1];
      g = '0x' + hex[2] + hex[2];
      b = '0x' + hex[3] + hex[3];
    } else if (hex.length == 7) {
      r = '0x' + hex[1] + hex[2];
      g = '0x' + hex[3] + hex[4];
      b = '0x' + hex[5] + hex[6];
    }

    return 'rgb(' + +r + ',' + +g + ',' + +b + ')';
  }
  private _RGBtoHSL(red: number, green: number, blue: number): string {
    // Make r, g, and b fractions of 1
    red /= 255;
    green /= 255;
    blue /= 255;

    // Find greatest and smallest channel values
    const cmin = Math.min(red, green, blue),
      cmax = Math.max(red, green, blue),
      delta = cmax - cmin;

    let h = 0,
      s = 0,
      l = 0;
    // Calculate hue
    // No difference
    if (delta == 0) h = 0;
    // Red is max
    else if (cmax == red) h = ((green - blue) / delta) % 6;
    // Green is max
    else if (cmax == green) h = (blue - red) / delta + 2;
    // Blue is max
    else h = (red - green) / delta + 4;

    h = Math.round(h * 60);

    // Make negative hues positive behind 360°
    if (h < 0) h += 360;

    // Calculate lightness
    l = (cmax + cmin) / 2;

    // Calculate saturation
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    // Multiply l and s by 100
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return 'hsl(' + h + ',' + s + '%,' + l + '%)';
  }
}
