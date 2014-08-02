ig.module(
	'plugins.shade.debug.lighting'
).requires(
	'impact.debug.menu',
	'impact.system',
	'plugins.shade.util',
	'plugins.shade.lighting',
	'plugins.shade.util.canvas'
).defines(function () { "use strict";

var getX = function (x) {
	return ig.system.getDrawPos(x - ig.game._rscreen.x);
}
var getY = function (y) {
	return ig.system.getDrawPos(y - ig.game._rscreen.y);
}

sh.Light.inject({
	debugDraw: function () {
		var ctx = ig.system.context;
		var origin = this.getOrigin();
		var x = getX(origin.x) + 0.5,
			y = getY(origin.y) + 0.5;

		ctx.save();
		ctx.globalCompositeOperation = 'source-over';
		ctx.strokeStyle = sh.util.canvas.colorToString(this.color);
		ctx.beginPath();
		ctx.rect(
			getX(this.pos.x) + 0.5,
			getY(this.pos.y) + 0.5,
			ig.system.scale * this.size.x - 1,
			ig.system.scale * this.size.y - 1);
		ctx.moveTo(x, y - 3);
		ctx.lineTo(x, y + 3);
		ctx.moveTo(x - 3, y);
		ctx.lineTo(x + 3, y);
		ctx.stroke();
		ctx.restore();
	}
});

sh.LightManager.inject({
	_draw: sh.LightManager.prototype.draw,

	_debugWall: function (wall) {
		var ctx = ig.system.context;
		ctx.globalCompositeOperation = 'source-over';		
		var poly = wall._polygon.map(function (pt) {
			return {
				x: ig.system.getDrawPos(pt.x - ig.game._rscreen.x),
				y: ig.system.getDrawPos(pt.y - ig.game._rscreen.y)
			};
		});
		sh.util.canvas.outline(ctx, { x: 0,y: 0 }, poly, 'red', 1);
	},

	draw: function () {
		if (sh.LightManager._debugEnableLights) {
			this._draw();
		}
		if (sh.LightManager._debugShowOutlines) {
			this.lights.forEach(function (light) { light.debugDraw(); });
			this.fixed.forEach(this._debugWall.bind(this));
		}
	}
});

sh.LightManager._debugEnableLights = true;
sh.LightManager._debugShowOutlines = true;

ig.debug.addPanel({
	type: ig.DebugPanel,
	name: 'lighting',
	label: 'Lighting',
	options: [
		{
			name: 'Draw Lighting',
			object: sh.LightManager,
			property: '_debugEnableLights'
		},
		{
			name: 'Show Outlines',
			object: sh.LightManager,
			property: '_debugShowOutlines'
		}
	]
});

});