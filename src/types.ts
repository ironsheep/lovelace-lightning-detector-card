import { ActionConfig, LovelaceCardConfig } from 'custom-card-helpers';

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
  // TODO add each ring [4-7]? or rings[]?  ea. has { count, distance, energy }
  ring0_dict?: JSONDictionary;
  ring1_dict?: JSONDictionary;
  ring2_dict?: JSONDictionary;
  ring3_dict?: JSONDictionary;
  ring4_dict?: JSONDictionary;
  ring5_dict?: JSONDictionary;
  ring6_dict?: JSONDictionary;
  ring7_dict?: JSONDictionary;
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
