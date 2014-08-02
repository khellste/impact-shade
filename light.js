ig.module(
	'plugins.shade.light'
).requires(
	'plugins.shade.drawing',
	'plugins.shade.util',
	'plugins.shade.util.canvas',
	'plugins.shade.util.math.geom'
).defines(function () {

// A point light
sh.Light = ig.Entity.extend({
	size: { x: 8, y: 8 },
	radius: 0,
	gradient: true,
	color: { r: 255, g: 255, b: 255 },
	gravityFactor: 0,
	drawing: null, drawingS: null,
	smooth: true,
	shadows: true,

	_cache: {
		drawPos: { x: 0, y: 0 },
		prevDrawPos: { x: 0, y: 0 }
	},

	_dirty: {
		size: false,
		color: false
	},

	init: function (x, y, settings) {
		this.parent(x, y, settings);

		// If these were set in Weltmeister, they are passed as strings...
		this.gradient = sh.util.bool(this.gradient);
		this.shadows = sh.util.bool(this.shadows);
		this.smooth = sh.util.bool(this.smooth);

		// Initialize properties with getter/setter properties
		this._initProperties();
		
		// Initialize the Drawing objects associated with this Light
		this._initDrawing();
	},

	// Draw this Light, plain and without shadows, onto the provided drawing.
	// This drawing will be used as a template for every time this light is
	// rendered, and will need to be updated whenever a fundamental property of
	// the light is changed (e.g., size, color, etc.);
	initialize: function (drawing) {
		var rx = drawing.width/2,
			ry = drawing.height/2,
			ctx = drawing.ctx,
			opq = ig.merge({ a: 1 }, this.color),
			clr = ig.merge({ a: 0 }, this.color);
		ctx.save();
		ctx.scale(rx, ry);
		ctx.fillStyle = this.gradient ?
			sh.util.canvas.makeRadialGradient(1, [opq, clr]) :
			sh.util.canvas.colorToString(opq);
		ctx.beginPath();
		ctx.arc(1, 1, 1, 0, 2 * Math.PI, false);
		ctx.fill();
		ctx.restore();
	},

	// Returns the "origin" or "source" of this light. If this Light is set to
	// cast shadows, any entity covering this origin point will completely
	// darken this Light.
	getOrigin: function () {
		return {
			x: this.pos.x + this.size.x/2 + this.offset.x,
			y: this.pos.y + this.size.y/2 + this.offset.y
		};
	},

	// Get a shadow polygon for the given entity. The coordinates in the
	// polygon should be absolute, e.g., they should be translated according
	// to the positions of this Light and the entity in question.
	getShadow: function (entity) {

		// The center/origin of this light
		var origin = this.getOrigin();

		// Calculate the entity's bounding box, or "polygon", which is
		// computed based on the `opaque` property for most Entities inside
		// the getter function of each Entity's `_polygon` property.
		var poly = entity._polygon;

		// Classify each point's position relative to the origin of this light.
		// The object `cl` is of the form { ul, ur, ll, lr }, where `ur` holds
		// the count (number) of points that were in the upper-left quadrant of
		// the light, `ur` the number in the upper-right, `ll` the number in
		// the lower-left, and `lr` the number in the lower-right.
		var cl = { ul: 0, ur: 0, ll: 0, lr: 0 };
		poly.forEach(function (pt) {
			if (pt.y <= origin.y && pt.x <= origin.x) cl.ul++;
			if (pt.y >= origin.y && pt.x <= origin.x) cl.ll++;
			if (pt.y <= origin.y && pt.x >= origin.x) cl.ur++;
			if (pt.y >= origin.y && pt.x >= origin.x) cl.lr++;
		});

		////// CONTRIVED HELPER FUNCTIONS //////

		// Returns a function that, when supplied the point V as an argument,
		// returns an object describing the intersection of the vector V-C
		// (where C is the `origin` of the current light, as defined above)
		// with the horizontal line y = `y`. This description object has the
		// form { orig, proj }, where `orig` is the original point passed in
		// to the function, and `proj` is the x-coordinate of the intersection.
		var projHorz = function (y) {
			return function (pt) {
				return {
					orig: pt,
					proj: sh.util.math.geom.projHorz(origin, pt, y)
				};
			};
		};

		// Returns a function that, when supplied the point V as an argument,
		// returns an object describing the intersection of the vector V-C
		// (where C is the `origin` of the current light, as defined above)
		// with the vertical line x = `x`. This description object has the
		// form { orig, proj }, where `orig` is the original point passed in
		// to the function, and `proj` is the y-coordinate of the intersection.
		var projVert = function (x) {
			return function (pt) {
				return {
					orig: pt,
					proj: sh.util.math.geom.projVert(origin, pt, x)
				};
			};
		};

		// Given an Array of { orig, proj } points `pts` (such as might result
		// from mapping `projVert` or `projHorz` over an Array of { x, y }
		// points), returns an object { hi, lo }, where `hi` holds the value of
		// the greatest value of any `proj` property on all the points passed
		// in, and `lo` holds the value of the least value of any `proj`
		// property on all the points passed in.
		var hiLo = function (pts) {
			var hi, lo;
			pts.forEach(function (pt) {
				if (pt.proj == null) return;
				if (!hi || pt.proj > hi.proj) hi = pt;
				if (!lo || pt.proj < lo.proj) lo = pt;
			})
			return { hi: hi, lo: lo };
		};

		////// LOGIC //////

		// The polygon is completely above the light
		if ((cl.ul || cl.ur) && !(cl.ll || cl.lr)) {
			var ends = hiLo(poly.map(projHorz(this.pos.y)));
			return [
				ends.hi.orig, ends.lo.orig,
				{ x: ends.lo.proj, y: this.pos.y },
				{ x: ends.hi.proj, y: this.pos.y }
			];
		}

		// The polygon is completely to the left of the light
		else if ((cl.ul || cl.ll) && !(cl.ur || cl.lr)) {
			var ends = hiLo(poly.map(projVert(this.pos.x)));
			return [
				ends.hi.orig, ends.lo.orig,
				{ x: this.pos.x, y: ends.lo.proj },
				{ x: this.pos.x, y: ends.hi.proj }
			];
		}

		// The polygon is completely to the right of the light
		else if ((cl.ur || cl.lr) && !(cl.ul || cl.ll)) {
			var ends = hiLo(poly.map(projVert(this.pos.x + this.size.x)));
			return [
				ends.hi.orig, ends.lo.orig,
				{ x: this.pos.x + this.size.x, y: ends.lo.proj },
				{ x: this.pos.x + this.size.x, y: ends.hi.proj }
			];
		}

		// The polygon is completely below the light
		else if ((cl.ll || cl.lr) && !(cl.ul || cl.ur)) {
			var ends = hiLo(poly.map(projHorz(this.pos.y + this.size.y)));
			return [
				ends.hi.orig, ends.lo.orig,
				{ x: ends.lo.proj, y: this.pos.y + this.size.y },
				{ x: ends.hi.proj, y: this.pos.y + this.size.y }
			];
		}

		// The polygon is completely NOT in the lower-right
		else if (!cl.lr) {
			var ud = hiLo(poly.map(projVert(this.pos.x)));
			var lr = hiLo(poly.map(projHorz(this.pos.y)));
			return [
				ud.hi.orig, lr.hi.orig,
				{ x: lr.hi.proj, y: this.pos.y },
				this.pos,
				{ x: this.pos.x, y: ud.hi.proj }
			];
		}

		// The polygon is completely NOT in the lower-left
		else if (!cl.ll) {
			var ud = hiLo(poly.map(projVert(this.pos.x + this.size.x)));
			var lr = hiLo(poly.map(projHorz(this.pos.y)));
			return [
				lr.lo.orig, ud.hi.orig,
				{ x: this.pos.x + this.size.x, y: ud.hi.proj },
				{ x: this.pos.x + this.size.x, y: this.pos.y },
				{ x: lr.lo.proj, y: this.pos.y }
			];
		}

		// The polygon is completely NOT in the upper-left
		else if (!cl.ul) {
			var ud = hiLo(poly.map(projVert(this.pos.x + this.size.x)));
			var lr = hiLo(poly.map(projHorz(this.pos.y + this.size.y)));
			return [
				lr.lo.orig, ud.lo.orig,
				{ x: this.pos.x + this.size.x, y: ud.lo.proj },
				{ x: this.pos.x + this.size.x, y: this.pos.y + this.size.y },
				{ x: lr.lo.proj, y: this.pos.y + this.size.y }
			];
		}

		// The polygon is completely NOT in the upper-right
		else if (!cl.ur) {
			var ud = hiLo(poly.map(projVert(this.pos.x)));
			var lr = hiLo(poly.map(projHorz(this.pos.y + this.size.y)));
			return [
				ud.lo.orig,
				lr.hi.orig,
				{ x: lr.hi.proj, y: this.pos.y + this.size.y },
				{ x: this.pos.x, y: this.pos.y + this.size.y },
				{ x: this.pos.x, y: ud.lo.proj }
			];
		}

		return [];
	},

	// Remove self from the scene
	remove: function () {
		sh.lightManager.removeLight(this);
	},

	// Resize this Light.
	resize: function (scale) {
		this.drawing.resize(scale, true);
		this._dirty.size = true;
	},

	// Overrides the base Entity class's handleMovementTrace() so that, by
	// default, Lights do not collide with things.
	handleMovementTrace: function (res) {
		this.pos.x += this.vel.x * ig.system.tick;
		this.pos.y += this.vel.y * ig.system.tick;
	},

	// Initialize the get/set properties on this instance of Light.
	_initProperties: function () {
		// Set it up so that this._cache.drawPos automatically updates
		var pos = { x: 0, y: 0 };
		Object.defineProperty(this._cache, 'drawPos', {
			get: function () {
				pos.x = ig.system.getDrawPos(this.pos.x - ig.game._rscreen.x);
				pos.y = ig.system.getDrawPos(this.pos.y - ig.game._rscreen.y);
				return pos;
			}.bind(this)
		});

		// Add a color property that, when changed, sets `_dirty.color` to true
		sh.util.addColorProperty(this, function () {
			this._dirty.color = true;
		}.bind(this), this.color);
	},

	// Private method that contains a template for initializing `this.drawing`,
	// but leaves the details to `initialize()` so that subclasses can do their
	// own thing. Enforces smoothness.
	_initDrawing: function () {
		var scale = this.smooth ? ig.system.scale : 1;
		this.initialize(
			this.drawing = new sh.Drawing({
				width: this.size.x * scale,
				height: this.size.y * scale,
				caching: true
			})
		);
		this.smooth || this.resize(ig.system.scale);
		this.drawingS = this.drawing.clone();
	},

	// Gets an array of nearby Entity objects, as well as the collision-map
	// "pseudo-entities" that are created by the injection to the collision
	// map's `init` function.
	_getNearby: function () {
		var ret = [];
		ig.game.entities.forEach(function (entity) {
			if (entity !== this && entity.opaque && this.touches(entity)) {
				ret.push(entity);
			}
		}.bind(this));
		sh.lightManager.fixed.forEach(function (wall) {
			if (this.touches(wall)) {
				ret.push(wall);
			}
		}.bind(this));
		return ret;
	},


	// Draw this light on the given canvas context
	_drawOn: function (ctx) {
		if (ctx.ctx) ctx = ctx.ctx;

		var x = this._cache.drawPos.x,
			y = this._cache.drawPos.y;

		// TODO What if size changes?
		// TODO What if gradient changes?

		// If color has changed, we need to re-initialize the cached image
		// that this light uses to render itself.
		if (this._dirty.color) {
			this._dirty.color = false;
			this._initDrawing();
		}

		var old = ctx.globalCompositeOperation;
		ctx.globalCompositeOperation = 'lighter';
		if (this.shadows) {
			this._drawShadows();
			ctx.drawImage(this.drawingS.data, x, y);
		} else {
			ctx.drawImage(this.drawing.data, x, y);
		}
		ctx.globalCompositeOperation = old;

		this._cache.prevDrawPos.x = x;
		this._cache.prevDrawPos.y = y;
	},

	// Erased this Light from the given canvas context
	_eraseFrom: function (ctx, color) {
		if (ctx.ctx) ctx = ctx.ctx;

		var x = this._cache.prevDrawPos.x,
			y = this._cache.prevDrawPos.y;

		// TODO w & h could be cached maybe
		var w = this.size.x * ig.system.scale;
		var h = this.size.y * ig.system.scale;
		if (typeof color === 'undefined') {
			ctx.clearRect(x, y, w, h);
		}
		else {
			if (typeof color !== 'string') {
				color = sh.util.canvas.colorToString(color);
			}
			ctx.fillStyle = color;
			ctx.fillRect(x, y, w, h);
		}
	},

	// Returns true if the given entity completely covers this Light, false
	// otherwise.
	_isCoveredBy: function (entity) {
		var origin = this.getOrigin();
		if (origin == null) return false;
		return sh.util.math.geom.polyContains(entity._polygon, origin);
	},

	// Gets the shadow polygon cast by the given entity. The second parameter
	// is an "out parameter" of the form {value:true/false}. The `value`
	// property will be set to true if the entity covers the light source,
	// false otherwise.
	_getShadow: function (entity, covered) {
		if (this._isCoveredBy(entity)) {
			covered.value = true;
			return [
				{ x: this.pos.x, y: this.pos.y },
				{ x: this.pos.x + this.size.x, y: this.pos.y },
				{ x: this.pos.x + this.size.x, y: this.pos.y + this.size.y },
				{ x: this.pos.x, y: this.pos.y + this.size.y }
			];
		}
		covered.value = false;
		return this.getShadow(entity);
	},

	// Draw the shadow of a single entity onto the provided 2D canvas context
	_drawShadow: function (ctx, entity) {
		var covered = { value: false };
		var shadow = this._getShadow(entity, covered);
		sh.util.canvas.fill(ctx, this.pos, shadow, 'black');
		return covered.value;
	},

	// Draw all the shadows of the nearby entities and collision-map "pseudo-
	// entities" onto `this.drawingS`, and render it to the scene.
	_drawShadows: function () {
		var nearby = this._getNearby();
		if (nearby.length === 0) {
			return;
		}

		// Setup
		this.drawingS = this.drawing.clone();
		var ctx = this.drawingS.ctx, fill = sh.util.canvas.fill;
		
		// Draw shadows
		var covered = false;
		for (var i = 0, len = nearby.length; i < len; i++) {
			if (this._drawShadow(ctx, nearby[i])) {
				covered = true;
				break;
			}
		}

		// Un-blacken opaque entities
		// TODO Potential optimization point
		var noShadows = ctx.createPattern(this.drawing.data, 'repeat');
		covered || nearby.forEach(function (entity) {
			fill(ctx, this.pos, entity._polygon, 'black');
			fill(ctx, this.pos, entity._polygon, noShadows);
		}.bind(this));
	},

	// Returns true if this Light has moved since the last time it was drawn.
	_hasMoved: function () {
		return (
			this._cache.drawPos.x !== this._cache.prevDrawPos.x ||
			this._cache.drawPos.y !== this._cache.prevDrawPos.y
		);
	},

	// Returns true if this Light collides with at least one other Light.
	_touchesAnotherLight: function () {
		return sh.lightManager.lights.some(this.touches.bind(this));
	},

	// Returns true if this Light is visible on the global canvas
	_isVisible: function () {
		var x = this._cache.drawPos.x, y = this._cache.drawPos.y;
		return !(
			y + this.size.y * ig.system.scale < 0 ||
			y > ig.system.context.canvas.height   ||
			x + this.size.x * ig.system.scale < 0 ||
			x > ig.system.context.canvas.width
		);
	},

	// Determines whether or not this Light needs to be redrawn
	_needsRedraw: function () {
		return (
			this._isVisible() && (			// Only visible lights matter
				this._hasMoved() ||			// Has this light moved?
				this._dirty.color ||		// Has the color changed?
				this._dirty.size ||			// Has the size changed?
				this._touchesAnotherLight()	// Is it touching another light?
			)
		);
	}
});

// Level editor tweaks
if (ig.global.wm) {
	sh.Light.inject({
		_wmScalable: true,

		draw: function () {

			// Weltmeister passes these as strings...
			this.smooth = sh.util.bool(this.smooth);
			this.gradient = sh.util.bool(this.gradient);

			// Re-initialize the drawing, and set as current frame
			this._initDrawing();
			this.currentAnim = this.drawing;

			// Since the LightManager is inactive (i.e., no blending), Lights
			// will appear opaque in Weltmeister unless we give them an alpha.
			// (Also, offset has a different meaning for Light, so we zero it
			// out before calling the parent `draw`.)
			ig.system.context.save();
			ig.system.context.globalAlpha = 0.1;
			var ox = this.offset.x, oy = this.offset.y;
			this.offset.x = this.offset.y = 0;
			this.parent();
			this.offset.x = ox;
			this.offset.y = oy;
			ig.system.context.restore();

			// Draw the origin
			var ctx = ig.system.context;
			var origin = this.getOrigin();
			var x = ig.system.getDrawPos(origin.x - ig.game._rscreen.x) + 0.5;
			var y = ig.system.getDrawPos(origin.y - ig.game._rscreen.y) + 0.5;
			ctx.save();
			ctx.strokeStyle = sh.util.canvas.colorToString(this.color);
			ctx.beginPath();
			ctx.moveTo(x, y - 3);
			ctx.lineTo(x, y + 3);
			ctx.moveTo(x - 3, y);
			ctx.lineTo(x + 3, y);
			ctx.stroke();
			ctx.restore();
		}
	});
}

});