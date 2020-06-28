import { ActionConfig, LovelaceCardConfig } from 'custom-card-helpers';
import { TemplateResult } from 'lit-element';

// maybe we store JSON parts here?  undecided!
interface JSONDictionary {
  [index: string]: string;
}

// TODO Add your configuration elements here for type-checking
export interface LightningDetectorCardConfig extends LovelaceCardConfig {
  type: string;
  name?: string;
  // new fields from our payload (via json_attributes_topic)
  period_in_minutes?: number;
  units?: string;
  out_of_range_count?: number;
  ring_count?: number;
  ring_width?: number;
  // display values for each ring
  ringsImage?: TemplateResult[];
  ringsLegend?: TemplateResult[];
  ringsTitles?: TemplateResult[];
  cardText?: TemplateResult[];
  // end new

  // colors from Lovelace config entries
  light_color?: string;
  medium_color?: string;
  heavy_color?: string;
  background_color?: string;
  light_text_color?: string;
  dark_text_color?: string;
  //
  show_warning?: boolean;
  show_error?: boolean;
  test_gui?: boolean;
  entity?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}
