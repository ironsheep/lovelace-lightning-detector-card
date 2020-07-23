# Lovelace Lightning Detector Card

![Project Maintenance][maintenance-shield]

[![License][license-shield]](LICENSE)

[![GitHub Release][releases-shield]][releases]

![Release](https://github.com/ironsheep/lovelace-lightning-detector-card/workflows/Release/badge.svg?branch=v1.0.0)

This is a Lovelace card showing you lightning in your local area **as detected by your own inexpensive sensor**. The card has range-rings that when colored indicate that lightning was detected at that range. There are additional details describing when the detections first started (Storm began) how frequent and how stong the detections are (relative power).

![Actual-Cards](https://user-images.githubusercontent.com/540005/87717634-f2f92b80-c76d-11ea-915a-66cfdeaa4c73.png)

With this card you can see a storm approach and how strong it is and when it leaves. You'll also see storm details such as when it started and when it ended.

### Where to get the Lightning Sensor

Please visit my sensor project for detail on how/where to get the sensor and for the software needed to send the data to Home Assistant. [See my [lightning-detector-MQTT2HA-Daemon](https://github.com/ironsheep/lightning-detector-MQTT2HA-Daemon) project.]



## Installation

Use [HACS](https://github.com/custom-components/hacs) (recommended)
or download *lightning-detector-card.js* from our [Latest Release](https://github.com/ironsheep/lovelace-lightning-detector-card/releases/latest) and place it in your www directory.

In your ui-lovelace.yaml (or resources.yaml, whichever you use for resources) add this:

```yaml
- url: /hacsfiles/lovelace-lightning-detector-card/lightning-detector-card.js
  type: module
```

If you don't use HACS please change the url accordingly.

## Config

| Name             | Type   | Default       | Description                 |
| ---------------- | ------ | ------------- | --------------------------- |
| title            | string |  {sensor name}             | Common title                

### The sensor setting affecting this display

The Lightning MQTT Daemon sends some settings to this card. These settings are:


| Name             | Type   | Default       | Description                 |
| ---------------- | ------ | ------------- | --------------------------- |
| period\_in\_minutes        | number |  5   | display detections during this period.            
| number\_of\_rings          | number |  5   | number of rings [3-7]    
| distance\_as               | string |  km  | distance units [km, mi]     
| end\_storm\_after\_minutes | number |  30  | mark storm ended after no further detections during this end period.  

To change any of these you'll want to modify the *config.ini* for your sensor and restart it. This card will then automatically pick up the new values.                 


---

You are always welcome to help me out for a couple of :coffee:'s or :pizza: slices!

[![coffee](https://www.buymeacoffee.com/assets/img/custom_images/black_img.png)](https://www.buymeacoffee.com/ironsheep)

[maintenance-shield]: https://img.shields.io/badge/maintainer-S%20M%20Moraco%20%40ironsheepbiz-blue.svg?style=for-the-badge
[license-shield]: https://camo.githubusercontent.com/bc04f96d911ea5f6e3b00e44fc0731ea74c8e1e9/68747470733a2f2f696d672e736869656c64732e696f2f6769746875622f6c6963656e73652f69616e74726963682f746578742d646976696465722d726f772e7376673f7374796c653d666f722d7468652d6261646765
[releases-shield]: https://img.shields.io/github/release/ironsheep/lovelace-lightning-detector-card.svg?style=for-the-badge
[releases]: https://github.com/ironsheep/lovelace-lightning-detector-card/releases