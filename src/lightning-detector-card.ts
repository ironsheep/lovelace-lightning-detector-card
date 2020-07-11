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

  NOT_SET: number = -1;

  // TODO Add any properities that should cause your element to re-render here
  @property() private hass!: HomeAssistant;
  @property() private _config!: LightningDetectorCardConfig;
  @property() private _firstTime: boolean = true;
  @property() private _period_minutes: number = 0;
  @property() private _storm_active: boolean = false;
  @property() private _entity_online: boolean = false;
  @property() private _updateTimerID: NodeJS.Timeout | undefined;
  @property() private _latestDetectionLabelID: string = '';

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

  public getCardSize(): number {
    return 6;
  }

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

      // set timer so our card updates timestamp every 5 seconds : 5000 (1 second: 1000)
      // FIXME: UNDONE remember to clear this interval when entity NOT avail. and restore when comes avail again...
      this._updateTimerID = setInterval(() => this._updateCardTimeStamp(), 1000);

      // set initial config values from entity, too
      this._config.units = stateObj?.attributes[Constants.RINGSET_UNITS_KEY];
      this._config.ring_count = stateObj?.attributes[Constants.RINGSET_RING_COUNT_KEY];
      this._config.ring_width = stateObj?.attributes[Constants.RINGSET_RING_WIDTH_KM_KEY];
      this._config.out_of_range_count = stateObj?.attributes[Constants.RINGSET_OUT_OF_RANGE_KEY];
      this._config.period_in_minutes = stateObj?.attributes[Constants.RINGSET_PERIOD_MINUTES_KEY];

      // set property values
      this._period_minutes = stateObj?.attributes[Constants.RINGSET_PERIOD_MINUTES_KEY];
      const stormStartTimestamp = this._getRingValueForKey(Constants.RINGSET_STORM_FIRST_KEY);
      this._storm_active = stormStartTimestamp != '' ? true : false;

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
      this._config.detail_label_count = this._config.ring_count! + 1;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ring_count: number = this._config.ring_count!;
      this._config.ringsImage = this._createRings(ring_count);
      this._config.ringsLegend = this._createRingsLegend(ring_count);
      this._config.ringsTitles = this._createRingLabels(ring_count);
      this._config.cardText = this._createCardText(ring_count);

      // console.log('ringsImage:');
      // console.log(this._config.ringsImage);
    }

    const card_timestamp_value = this._storm_active ? 'Last report: ' + relativeInterp + '!' : '';

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
        <div id="card-timestamp" class="last-heard">${card_timestamp_value}</div>
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
    const ring_count = this._config.ring_count!;

    // Label: Status Text
    //
    const statusLabel: string = this._createCardStatusText(ring_count);
    let labelElement = root.getElementById('card-status');
    labelElement.textContent = statusLabel;
    const interpLabels: string[] = this._createCardDetailText(ring_count);

    // Label: Status Text
    //
    const nbr_substatus_labels = Constants.MAX_SUBSTATUS_LINES;
    const substatusLabels: string[] = this._createCardSubStatusText();
    //console.log('substatusLabels:');
    //console.log(substatusLabels);
    for (let line_index = 0; line_index < nbr_substatus_labels; line_index++) {
      const label_id = this._calcSubstatusLabelIdFromLineIndex(line_index);
      let labelText: string = '';
      if (line_index < substatusLabels.length) {
        labelText = substatusLabels[line_index];
      }
      const labelElement = root.getElementById(label_id);
      labelElement.textContent = labelText;
    }

    // LABELs: Detail Text
    //
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const nbr_detail_labels: number = this._config.detail_label_count!;
    for (let line_index = 0; line_index < nbr_detail_labels; line_index++) {
      let labelText: string = '';
      if (line_index < interpLabels.length) {
        labelText = interpLabels[line_index];
      }
      const label_id = this._calcDetailClassIdForIndex(line_index);
      labelElement = root.getElementById(label_id);
      labelElement.textContent = labelText;
    }

    // update rings
    //
    for (let ring_index = 0; ring_index <= ring_count; ring_index++) {
      // adjust ring detections count and color
      let label_id = this._calcCountLabelIdFromRingIndex(ring_index);
      const currRingDictionary = this._getRingDictionaryForRingIndex(ring_index);
      const currCount = currRingDictionary[Constants.RING_COUNT_KEY];
      let labelElement = root.getElementById(label_id);
      labelElement.textContent = currCount;
      //const currTextColor = currCount > 0 ? this._config.dark_text_color : this._config.light_text_color;  // <--- DIDN'T WORK (illegal? color value)
      // FIXME: UNDONE get better colors here... and match theme...
      const currTextColor = currCount > 0 ? '#000' : '#fff';
      labelElement.style.setProperty('color', currTextColor);
      // adjust ring distances color
      label_id = this._calcDistanceLabelIdFromRingIndex(ring_index);
      labelElement = root.getElementById(label_id);
      labelElement.style.setProperty('color', currTextColor);
      // adjust ring color
      const ring_id = this._calcRingIdFromRingIndex(ring_index);
      const ringElement = root.getElementById(ring_id);
      const currRingColor = this._calcRingColor(ring_index);
      ringElement.style.setProperty('fill', currRingColor);
    }
  }

  // ===========================================================================
  //  PRIVATE (utility) functions
  // ---------------------------------------------------------------------------

  private _updateCardTimeStamp(): void {
    // call when time to refresh our card's relative time for last report and last detection
    const root: any = this.shadowRoot;
    const stateObj = this._config.entity ? this.hass.states[this._config.entity] : undefined;
    if (stateObj != undefined) {
      //
      //  Update top-right of card
      //
      if (this._latestDetectionLabelID != '') {
        const labelElement = root.getElementById(this._latestDetectionLabelID);
        if (labelElement != undefined) {
          const mostRecentDetection = this._getRingValueForKey(Constants.RINGSET_LAST_DETECTION_KEY);
          let detectionInterp: string = 'None this period';
          if (mostRecentDetection != '') {
            detectionInterp = relativeTime(new Date(mostRecentDetection), this.hass?.localize);
          }
          const newLabel = 'Latest: ' + detectionInterp;
          labelElement.textContent = newLabel;
        }
      }

      //
      //  Update bottom of card
      //
      const labelElement = root.getElementById('card-timestamp');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const stateStrInterp = computeStateDisplay(this.hass?.localize, stateObj!, this.hass?.language);
      const relativeInterp =
        stateStrInterp === undefined ? '{unknown}' : relativeTime(new Date(stateStrInterp), this.hass?.localize);
      const newLabel = this._storm_active ? 'Last report: ' + relativeInterp : '';
      labelElement.textContent = newLabel;
    }
  }

  private _getRingValueForKey(key: string): string {
    // HELPER UTILITY: get requested named value from config
    const stateObj = this._config.entity ? this.hass.states[this._config.entity] : undefined;
    let ring_value: string = ''; // empty string
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (key in stateObj?.attributes!) {
      ring_value = stateObj?.attributes[key];
    }
    return ring_value;
  }

  private _getRingDictionaryForRingIndex(ring_index: number): object {
    // HELPER UTILITY: get requested ring dictionary from config
    const stateObj = this._config.entity ? this.hass.states[this._config.entity] : undefined;
    const ring_key: string = 'ring' + ring_index;
    let ringDictionary: object = {}; // emtpy dictionary
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (ring_key in stateObj?.attributes!) {
      ringDictionary = stateObj?.attributes[ring_key];
    }
    return ringDictionary;
  }

  private _calcRingColorClass(ring_index: number): string {
    // I was thinking of using class id's to control color...
    //  it turns out that was not the easier path...
    if (ring_index) {
    } // kill compiler detected error

    // color class
    //   high-detections, medium-detections, low-detections, no-detections
    //   high-power, medium-power, low-power, no-power

    // encode our detectins count
    const colorCountClass: string = 'no-detections';

    // encode our energy level
    const colorEnergyClass: string = 'no-power';

    // combine the two and return the new class
    const colorClass = colorCountClass + ' ' + colorEnergyClass;
    return colorClass;
  }

  private _calcRingColor(ring_index: number): string {
    // generate colors which encode detection count and energy
    //   we show count by switching colors (none -> yellow -> orange -> red "most intense")
    //   we show energy by changing brightness of the color (low intensity, less bright - high intensity, most bright)
    //
    const ringDictionary = this._getRingDictionaryForRingIndex(ring_index);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let color = this._config.ring_no_color!;
    const count: number = ringDictionary[Constants.RING_COUNT_KEY];
    if (count > 0) {
      const energy: number = ringDictionary[Constants.RING_ENERGY_KEY];

      const detections_high = 10;
      const detections_medium = 3;
      const detections_low = 0;

      const energy_high = 200000;
      const energy_medium = 100000;
      const energy_low = 0;

      // encode our detections count & energy
      if (count >= detections_high) {
        // reds
        if (energy >= energy_high) {
          color = '#ff2600';
        } else if (energy >= energy_medium) {
          color = '#ff7158';
        } else if (energy > energy_low) {
          color = '#ff9d8b';
        }
      } else if (count >= detections_medium) {
        // oranges
        if (energy >= energy_high) {
          color = '#ff9300';
        } else if (energy >= energy_medium) {
          color = '#ffba5a';
        } else if (energy > energy_low) {
          color = '#ffce8c';
        }
      } else if (count >= detections_low) {
        // yellows
        if (energy >= energy_high) {
          color = '#fffb00';
        } else if (energy >= energy_medium) {
          color = '#fffc54';
        } else if (energy > energy_low) {
          color = '#fffd8b';
        }
      }
    }
    return color;
  }

  private _calcCircleRadius(ring_index: number, ring_count: number): string {
    // calculate the radius we need for a specific ring
    let radius = 0;
    if (this._storm_active || ring_count > 0) {
      const total_segment_widths = ring_count * 2 + 2; // +2 for center - total widths are...
      const ring_diameter = ring_index * 2 + 2; // and this ring dia is...
      const diameter_percent = (ring_diameter / total_segment_widths) * 0.85; // 0.85 = 85% of width
      radius = diameter_percent * 5; // scale to 10 units of width (radius = 5)
    }
    return radius.toFixed(1);
  }

  private _calcDistanceLabelIdFromRingIndex(ring_index: number): string {
    // return the ID for a given ring distanceLabel
    const label_id: string = 'dist-ring' + ring_index + '-id';
    return label_id;
  }

  private _calcCountLabelIdFromRingIndex(ring_index: number): string {
    // return the ID for a given ring detection count Label
    const label_id: string = 'ct-ring' + ring_index + '-id';
    return label_id;
  }

  private _calcRingIdFromRingIndex(ring_index: number): string {
    // return the ID for a given ring
    return 'ring' + ring_index;
  }

  private _calcDetailClassIdForIndex(line_index: number): string {
    // return the ID for a specified detail line
    const lineClassId: string = 'card-detail' + line_index;
    return lineClassId;
  }

  private _calcSubstatusLabelIdFromLineIndex(line_index: number): string {
    // return the ID for a specified detail line
    const lineClassId: string = 'card-substatus' + line_index;
    return lineClassId;
  }

  // WARING: ABOVE and BELOW ring ID values must be consistant!

  private _createRings(ring_count: number): TemplateResult[] {
    // create the colorable rings for this card.
    //   NOTE: I was unable to find a working solution to programmaticaly generating these so i gave up and hard-coded
    //    the circles within the svg object.   ...sigh...
    const svgArray: TemplateResult[] = [];

    if (ring_count != undefined) {
      const ringClassArray: string[] = [];
      const ringRadiusArray: string[] = [];
      for (let ring_index = 0; ring_index <= ring_count; ring_index++) {
        const ringColorClass: string = this._calcRingColorClass(ring_index);
        ringClassArray.push(ringColorClass);
        const ringRadius: string = this._calcCircleRadius(ring_index, ring_count);
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
    }
    return svgArray;
  }

  private _createRingsLegend(ring_count: number): TemplateResult[] {
    // create the LEGEND text areas for this card
    //   along with ring distance LEGEND text areas
    const labelsArray: TemplateResult[] = [];
    if (ring_count != undefined) {
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

      const units_string: string = this._getRingValueForKey(Constants.RINGSET_UNITS_KEY);
      for (let ring_index = 0; ring_index <= ring_count; ring_index++) {
        const currRingDictionary = this._getRingDictionaryForRingIndex(ring_index);
        const count = currRingDictionary[Constants.RING_COUNT_KEY];
        const darkness = count == 0 ? 'light' : 'dark';
        const label_darkness: string = 'label-' + darkness;

        const from_dist = currRingDictionary[Constants.RING_FROM_UNITS_KEY];
        const to_dist = currRingDictionary[Constants.RING_TO_UNITS_KEY];
        let ring_distance_label: string = from_dist + ' - ' + to_dist + ' ' + units_string;
        let ring_class: string = 'ring' + ring_index + '-dist';
        if (ring_index == 0) {
          ring_distance_label = 'Overhead';
          ring_class = 'ring0 centered';
        }
        const ring_dist_id: string = this._calcDistanceLabelIdFromRingIndex(ring_index);
        labelsArray.push(html`
          <div id="${ring_dist_id}" class="${ring_class} ${label_darkness}">${ring_distance_label}</div>
        `);
      }
    }
    return labelsArray;
  }

  private _createRingLabels(ring_count: number): TemplateResult[] {
    // create the labels for this card
    const labelsArray: TemplateResult[] = [];
    for (let ring_index = 0; ring_index <= ring_count; ring_index++) {
      const currRingDictionary = this._getRingDictionaryForRingIndex(ring_index);
      const ring_class: string = 'ring' + ring_index + '-det';
      const count = currRingDictionary[Constants.RING_COUNT_KEY];
      const darkness = count == 0 ? 'light' : 'dark';
      const label_darkness: string = 'label-' + darkness;
      const label_ct_id = this._calcCountLabelIdFromRingIndex(ring_index);
      labelsArray.push(html`
        <div id="${label_ct_id}" class="${ring_class} ${label_darkness}">${count}</div>
      `);
    }
    return labelsArray;
  }

  private _createCardStatusText(ring_count: number): string {
    // status text is a single bold line of text at top right of card
    //  SHOWS: 1-line state of lightning in local area

    let title: string = '';
    if (this._storm_active) {
      // we have reporting data...
      const kMinNotSet = 999;
      const kMaxNotSet = -1;
      let min_ring_dist = kMinNotSet;
      let max_ring_dist = kMaxNotSet;
      const units_string: string = this._getRingValueForKey(Constants.RINGSET_UNITS_KEY);
      const out_of_range = parseInt(this._getRingValueForKey(Constants.RINGSET_OUT_OF_RANGE_KEY), 10);
      let total_count = out_of_range;
      for (let ring_index = 0; ring_index <= ring_count; ring_index++) {
        const currRingDictionary = this._getRingDictionaryForRingIndex(ring_index);
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
      const range_text = 'Lightning: ' + min_ring_dist + ' - ' + max_ring_dist + ' ' + units_string;
      title = total_count == 0 ? 'No Lightning in Area' : range_text;
      if (total_count > 0 && total_count == out_of_range) {
        title = 'Lightning: out-of-range';
      }
    }
    // return empty string of not reporting yet...
    return title;
  }

  private _createCardSubStatusText(): string[] {
    // SubStatus is 3 labels at top right of card (primary color. smaller font)
    // SHOWS: storm status information
    //
    //   Storm Started: {time since}
    //   Last Detection: {time since}
    //   5 min periods
    //
    const subStringArray: string[] = [];
    const uiDateOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };

    const stormStartTimestamp: string = this._getRingValueForKey(Constants.RINGSET_STORM_FIRST_KEY);
    // force following to update too...
    this._storm_active = stormStartTimestamp != '' ? true : false;
    const mostRecentDetection = this._getRingValueForKey(Constants.RINGSET_LAST_DETECTION_KEY);

    let detectionsThisPeriod: boolean = false;
    if (stormStartTimestamp != '') {
      const relativeInterp = relativeTime(new Date(stormStartTimestamp), this.hass?.localize);
      subStringArray.push('Started: ' + relativeInterp); // [0]

      let detectionInterp: string = 'None this period';
      if (mostRecentDetection != '') {
        detectionInterp = relativeTime(new Date(mostRecentDetection), this.hass?.localize);
        detectionsThisPeriod = true;
      }
      subStringArray.push('Latest: ' + detectionInterp); // [1]
      const lblIndex = subStringArray.length - 1;
      this._latestDetectionLabelID = 'card-substatus' + lblIndex;
      //console.log('- _latestDetectionLabelID:');
      //console.log(this._latestDetectionLabelID);
    } else {
      subStringArray.push('Detector not yet reporting'); // [0]
      this._latestDetectionLabelID = '';
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sensor_name = this._config.entity!;
    const isPastRingset: boolean = sensor_name.includes('past_') ? true : false;
    if (isPastRingset) {
      const asOfTimestamp: string = this._getRingValueForKey(Constants.RINGSET_TIMESTAMP_KEY);
      if (asOfTimestamp != '') {
        const date = new Date(asOfTimestamp);

        subStringArray.push('As of: ' + date.toLocaleTimeString('en-us', uiDateOptions)); // [1] or [2]
      }
    } else {
      let periodInterp: string = '';
      if (this._period_minutes != 0 && this._period_minutes != undefined) {
        const suffix = this._period_minutes == 1 ? '' : 's';
        periodInterp = this._period_minutes + ' minute' + suffix;
      }
      if (this._storm_active && periodInterp != '') {
        subStringArray.push('Showing: last ' + periodInterp); // [1] or [2]
      }
    }
    if (detectionsThisPeriod == false && isPastRingset == false) {
      // show storm end in minutes and when it will end if no more (but only for current ring-set)
      const stormEndInMinutes = this._getRingValueForKey(Constants.RINGSET_STORM_END_MINUTES_KEY);
      const predictedStormEnd = this._calcStormEndDate();
      if (predictedStormEnd != undefined) {
        subStringArray.push('Ends in ' + stormEndInMinutes + ' minutes:');
        subStringArray.push(predictedStormEnd.toLocaleTimeString('en-us', uiDateOptions));
      } else {
        if (stormStartTimestamp != '') {
          subStringArray.push('- bad storm end calcs?? -');
        }
      }
    }
    return subStringArray;
  }

  private _calcStormEndDate(): Date | undefined {
    let predictedStormEnd: Date | undefined = undefined;
    const mostRecentDetection = this._getRingValueForKey(Constants.RINGSET_STORM_LAST_KEY);
    const stormEndInMinutes: number = parseInt(this._getRingValueForKey(Constants.RINGSET_STORM_END_MINUTES_KEY), 10);
    if (mostRecentDetection != '' && mostRecentDetection != '') {
      const detectionAsDate = new Date(mostRecentDetection);
      predictedStormEnd = new Date(detectionAsDate.getTime() + stormEndInMinutes * 60000);
    }
    return predictedStormEnd;
  }

  private _createCardDetailText(ring_count: number): string[] {
    // DetailText is ring_count + 1 labels at top left of card (2ndary color)
    //  SHOWS: detection detail (additional info supporting ring coloring)
    const distancesStringArray: string[] = [];
    const out_of_range: number = parseInt(this._getRingValueForKey(Constants.RINGSET_OUT_OF_RANGE_KEY), 10);
    if (out_of_range > 0) {
      const interp_label = out_of_range + ' detections, out-of-range';
      distancesStringArray.push(interp_label);
    }
    for (let ring_index = 0; ring_index <= ring_count; ring_index++) {
      const currRingDictionary = this._getRingDictionaryForRingIndex(ring_index);
      const energy = currRingDictionary[Constants.RING_ENERGY_KEY];
      const count = currRingDictionary[Constants.RING_COUNT_KEY];
      if (count > 0) {
        let max_power_interp = '200k';
        const energy_in_k: number = Math.round(energy / 10000) * 10;
        if (energy_in_k > 5) {
          max_power_interp = energy_in_k + 'k+';
        } else {
          max_power_interp = '< 5k';
        }

        const interp_label = count + ' detections, max power ' + max_power_interp;
        distancesStringArray.push(interp_label);
      }
    }
    if (distancesStringArray.length == 0) {
      distancesStringArray.push('No detection events...');
    }
    return distancesStringArray;
  }

  private _createCardText(ring_count: number): TemplateResult[] {
    // create the information text areas for this card
    const labelsArray: TemplateResult[] = [];
    const distancesHTMLArray: TemplateResult[] = [];
    const statusLabel: string = this._createCardStatusText(ring_count);
    const interpLabels: string[] = this._createCardDetailText(ring_count);

    const nbr_detail_labels = ring_count + 1;

    for (let label_index = 0; label_index < interpLabels.length; label_index++) {
      const interp_label = interpLabels[label_index];
      distancesHTMLArray.push(
        html`
          ${interp_label}
        `,
      );
    }

    labelsArray.push(html`
      <div id="card-status" class="status-text">${statusLabel}</div>
      <div id="card-substatus0" class="substatus-text substatus-text-ln0"></div>
      <div id="card-substatus1" class="substatus-text substatus-text-ln1"></div>
      <div id="card-substatus2" class="substatus-text substatus-text-ln2"></div>
      <div id="card-substatus3" class="substatus-text substatus-text-ln3"></div>
      <div id="card-substatus4" class="substatus-text substatus-text-ln4"></div>
    `);

    for (let line_index = 0; line_index < nbr_detail_labels; line_index++) {
      let labelText: TemplateResult = html``;
      if (line_index < interpLabels.length) {
        labelText = distancesHTMLArray[line_index];
      }

      // for TESTING placement only
      //const testLabelText = 'Test Label line ' + line_index;
      //labelText = html`
      //  ${testLabelText}
      //`;

      const lineClassId = this._calcDetailClassIdForIndex(line_index);
      const lineClassName = 'interp-text interp-text-ln' + line_index;
      labelsArray.push(html`
        <div id="${lineClassId}" class="${lineClassName}">
          ${labelText}
        </div>
      `);
    }
    return labelsArray;
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
        padding: 120px 0px 0px 0px; /* NOTE: we add +16 to top pad so we have space at top of card when no-name! */
        margin: 0px 0px 0px 0px; /* NOTE: top should be -16 if name is present */
        display: block;
        /*background-color: yellow;*/
        position: relative; /* ensure descendant abs-objects are relative this? */
      }
      .rings {
        /* background-color: green; */
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
        color: var(--primary-text-color);
      }
      .substatus-text-ln0 {
        position: absolute;
        top: 40px;
      }
      .substatus-text-ln1 {
        position: absolute;
        top: 56px;
      }
      .substatus-text-ln2 {
        position: absolute;
        top: 72px;
      }
      .substatus-text-ln3 {
        position: absolute;
        top: 88px;
      }
      .substatus-text-ln4 {
        position: absolute;
        top: 104px;
      }
      .substatus-text {
        position: absolute;
        right: 10px;
        /* font-family: Arial, Helvetica, sans-serif; */
        font-style: normal;
        font-size: 13px;
        line-height: 16px;
        /* color: #8c8c8c; */
        color: var(--secondary-text-color);
      }
      .interp-text-ln0 {
        position: absolute;
        top: 36px;
      }
      .interp-text-ln1 {
        position: absolute;
        top: 51px;
      }
      .interp-text-ln2 {
        position: absolute;
        top: 66px;
      }
      .interp-text-ln3 {
        position: absolute;
        top: 81px;
      }
      .interp-text-ln4 {
        position: absolute;
        top: 96px;
      }
      .interp-text-ln5 {
        position: absolute;
        top: 111px;
      }
      .interp-text-ln6 {
        position: absolute;
        top: 126px;
      }
      .interp-text-ln7 {
        position: absolute;
        top: 141px;
      }

      .interp-text {
        position: absolute;
        left: 10px;
        /* font-family: Arial, Helvetica, sans-serif; */
        font-style: normal;
        font-size: 13px;
        line-height: 16px;
        /* color: #8c8c8c; */
        text-align: right;
        color: var(--primary-text-color);
        /*background-color: orange;*/
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
        bottom: 0.5%;
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
        font-size: 9px;
      }
      .label-light {
        color: #bdc1c6;
        font-size: 9px;
      }

      .last-heard {
        position: absolute;
        bottom: 5px;
        left: 10px;
        font-size: 12px;
        color: var(--secondary-text-color);
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
}
