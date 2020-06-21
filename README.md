# Lovelace Lightning Detector Card

![Project Maintenance][maintenance-shield]

We are working on a new Lovelace card for depicting lightning in your local area as shown by your own inexpensive sensor.  Here are what we think the card will look like.

![Discovered by Home Assistant](Docs/images/goal-cards.png)


NOTE: this is our initial mockup. We'll see how close we get over time. 

## Support

Hey dude! Help me out for a couple of :coffee:'s or :pizza: slices!

[![coffee](https://www.buymeacoffee.com/assets/img/custom_images/black_img.png)](https://www.buymeacoffee.com/ironsheep)

### Sensor for this card

You buy an AS3935 sensor and attach it to a Raspberry Pi and the software for communicating the sensor data to home assistant can be found in at [lightning-detector-MQTT2HA-Daemon](https://github.com/ironsheep/lightning-detector-MQTT2HA-Daemon) project.

-----

-------------------- - - - - - -  CAUTION -- CAUTION -- CAUTION

WHILE THIS CARD IS NOT YET READY FOR USE. The following is beginning to appear here as we are building the card for you.

Please be patient, this marker will be removed when the card is finally ready for use (*after we have a working version for you to use, of course.*)

-------------------- - - - - - -  CAUTION -- CAUTION -- CAUTION

-----

## Installation

Use [HACS](https://github.com/custom-components/hacs) (recommended)
or download [lightning-detector-card.js](https://github.com/ironsheep/lovelace-lightning-detector-card/raw/master/lightning-detector-card.js) and place it in your www directory.

In your ui-lovelace.yaml add this:

```yaml
- url: /hacsfiles/lightning-detector-card/lightning-detector-card.js
  type: model
```

If you don't use HACS please change the url accordingly.

## Config

| Name             | Type   | Default | Description                                      |
|------------------|--------|---------|--------------------------------------------------|
| title            | string |         | Common title                                     |
| light_color             | string    | yellow       | color override (optional)                                    |
| medium_color              | string    | orange     | color override (optional)                                    |
| heavy_color           | string |     red    | color override (optional)                          |
| background_color | string |     theme-default    | background color (optional) |
| light\_text_color           | string |     black   | color override (optional)                          |
| dark\_text_color           | string |      light-grey     | color override (optional)                          |               

### The sensor setting affect this display!
e.g., The number of rings is controlled by the *config.ini* in your sensor setup files.

## License

Copyright © 2020 Iron Sheep Productions, LLC. All rights reserved.<br />
Licensed under the MIT License. <br>
<br>
Follow these links for more information:
### [Copyright](copyright) | [License](LICENSE)

[maintenance-shield]: https://img.shields.io/badge/maintainer-S%20M%20Moraco%20%40ironsheepbiz-blue.svg?style=for-the-badge