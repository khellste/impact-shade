shade
======

A lighting/shadow engine for the ImpactJS game engine

Features
------

* **Standalone.** Doesn't depend on Impact++ or other large libraries.
* **Simple.** Lights are just ImpactJS `Entity`s, and can be created and manipulated the same way you would do for any other `Entity`. Shadow-casting lights integrate seamlessly with `CollisionMap` so that collision tiles of any shape cast shadows.
* **Configurable.** Change the color, smoothness, and gradient of your lights. Whether or not lights cast shadows can also be configured.
* **Extensible.** Though the library currenly only implements point lights, it's simple to implement other types of lights.
* **Dynamic.** Moving lights, moving objects, and moving shadows.

Installation
------

* Copy the **shade** source (the folder containing "main.js") into a folder called "shade" in your ImpactJS project's "lib/plugins" folder.
* Register the plugin in your own "main.js" file:
```javascript
.requires(
    'plugins.shade.main'
)
```
* Create `sh.Light` entities in your game. You can do this programmatically by `require`ing `'plugins.shade.light'` and calling `ig.game.spawnEntity(sh.Light, x, y, settings)`. Alternatively, you can add it to a map using Weltmeister. The easiest way to expose `sh.Light` to Weltmeister is to create a simple subclass in your "lib/game/entities" folder:
```javascript
ig.module(
    'game.entities.light'
).requires(
    'plugins.shade.light'
).defines(function () {

    EntityLight = sh.Light.extend({ });

});
```

Usage
------

**shade** `sh.Light`s are created just like any other `Entity` in ImpactJS. To configure an `sh.Light`, simply pass in settings via `Game.spawnEntity` or via Weltmeister. `sh.Light` supports the following options:
* `size` The size of the light.
* `gradient` Set to `true` to indicate that this light should have a gradient.
* `color` A color object of the form `{ r, g, b }`. Changing this at any time after the `Light` has already been initialized will immediately update the `Light`.
* `smooth` Set this to `false` to get a "retro"/pixelated look proportional to `ig.game.scale`.
* `shadows` Set this to `false` to prevent this light from creating shadows when objects are in its way. Not casting shadows is better for performance.

In addition to `Light`, there is also a global `sh.LightManager`. The only really interesting thing about the light manager is that you can change the global ambient light by modifying the `color` property on the global `sh.lightManager`.

One new property has been added to `ig.Entity`'s prototype as well: the `opaque` property. When set to `false`, the given `Entity` will not cast shadows. When set to `true` a shadow will be cast by the given `Entity`'s bounding rectangle (as determined by its position and size). This property can also be set to an `Array` of `{ x, y }` points defining a *concave* polygon to be used for shadow casting instead of its bounding rectangle.
