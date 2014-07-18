ig.module(
	'plugins.shade.lighting'
).requires(
	'plugins.shade.drawing',
	'plugins.shade.util.canvas',
	'plugins.shade.util.math.geom',
	'plugins.shade.util',
	'impact.entity',
	'impact.game',
	'impact.collision-map',
	'impact.timer'
).defines(function () { "use strict";
window.sh = window.sh || {};

sh.LightManager = ig.Class.extend({
	lights: [], dirty: [], fixed: [],
	scene: null,
	color: { r: 16, g: 16, b: 16 },	// Ambient light
	_initialized: false,

	init: function () {
		this._initProperties();
	},

	_initProperties: function () {
		// A `fillStyle` property for canvases to use
		Object.defineProperty(this, 'fillStyle', {
			get: function () {
				return sh.util.canvas.RGBAtoCSS(this.color);
			}.bind(this)
		});

		// Add a color property that, when changed, marks `_initialized` as
		// false
		sh.util.addColorProperty(this, function () {
			this._initialized = false;
		}.bind(this), this.color);
	},

	removeLight: function (light) {
		// TODO Implement this
		throw 'Unimplemented';
	},

	addLight: function (light) {
		this.lights.push(light);		
	},

	addFixedEntity: function (entity) {
		this.fixed.push(entity);
	},

	_initDarkness: function () {

		// Determine the size of the world
		var map = ig.game.collisionMap || ig.game.backgroundMaps[0];
		var w = map.tilesize * ig.system.scale * map.width,
			h = map.tilesize * ig.system.scale * map.height;

		// Initialize the lighting Drawing
		var scene = this.scene = new sh.Drawing({ height: h, width: w });

		// Draw darkness
		scene.ctx.fillStyle = this.fillStyle;
		scene.ctx.fillRect(0, 0, w, h);

		// Draw each light
		this.lights.forEach(function (light) { light.drawOn(scene); });
	},

	update: function () {

		// TODO What if ambient color has changed since the last update?

		if (!this._initialized) {
			this._initDarkness();
			this._initialized = true;
		}

		var light;
		for (var i = 0; i < this.lights.length; i++) {
			light = this.lights[i];
			if (light.needsRedraw()) {
				this.dirty.push(light);
				light.eraseFrom(this.scene, this.fillStyle);
			}
		}

		while (light = this.dirty.pop()) {
			light.drawOn(this.scene);
		}
	},

	draw: function () {
		this.update();

		// Render lights
		var ctx = ig.system.context, old = ctx.globalCompositeOperation;
		ctx.globalCompositeOperation = 'multiply';
		ctx.drawImage(this.scene.data, 0, 0);
		ctx.globalCompositeOperation = old;
	}
});

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
		this.gradient = sh.util.bool(this.gradient);
		this.smooth   = sh.util.bool(this.smooth);
		this._initProperties();

		// Enforce that length and height must be the same
		// TODO Allow length and height to differ, resulting in an ovular light
		this.size.x = this.size.y = Math.min(this.size.x, this.size.y);
		this.radius = this.size.x / 2;
		
		// For "smooth" lights, render the cached light directly to a Drawing
		// with the same size as the actual display size
		if (this.smooth) {
			this._initDrawing(this.radius * ig.system.scale);
		}

		// For pixelated lights, render the cached light on a small Drawing and
		// then upscale to the display size
		else {
			this._initDrawing(this.radius);
			this.resize(ig.system.scale);
			this.drawingS = this.drawing.clone();
		}
	},

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

	handleMovementTrace: function (res) {
		this.pos.x += this.vel.x * ig.system.tick;
		this.pos.y += this.vel.y * ig.system.tick;
	},

	resize: function (scale) {
		this.drawing.resize(scale, true);
		this._dirty.size = true;
	},

	_initDrawing: function (radius) {
		var r = radius, d = r * 2;
		this.drawing = new sh.Drawing({ width: d, height: d, caching: true });
		var ctx = this.drawing.ctx, opq = ig.merge({ a: 1 }, this.color);
		if (this.gradient) {
			var clr = ig.merge({ a: 0 }, this.color);
			ctx.fillStyle = sh.util.canvas.makeRadialGradient(r, [opq, clr]);
			ctx.fillRect(0, 0, d, d);
		}
		else {
			ctx.fillStyle = sh.util.canvas.RGBAtoCSS(opq);
			ctx.arc(r, r, r, 0, Math.PI * 2, false);
			ctx.fill();
		}
		this.drawingS = this.drawing.clone();
	},

	_hasMoved: function () {
		return (
			this._cache.drawPos.x !== this._cache.prevDrawPos.x ||
			this._cache.drawPos.y !== this._cache.prevDrawPos.y
		);
	},

	_touchesAnotherLight: function () {
		return sh.lightManager.lights.some(this.touches.bind(this));
	},

	// TODO: Optimize based on the following:
	// 1. Did my draw position change?
	// 2. Did my color change?
	// 3. Did my size change?
	// 4. Am I colliding with another light?
	// 5. Did one of the entities I cast a shadow on move?
	// 6. Am I visible on the screen?
	needsRedraw: function () {

		if (this._hasMoved() ||				// Has this light moved?
			this._dirty.color ||			// Has the color changed?
			this._dirty.size ||				// Has the size changed?
			this._touchesAnotherLight()) {	// Is it touching another light?
			return true;
		}

		// TODO: Did shadow move

		// TODO: Is visible

		return false;
	},

	drawOn: function (ctx) {
		if (ctx.ctx) ctx = ctx.ctx;

		var x = this._cache.drawPos.x,
			y = this._cache.drawPos.y;

		// TODO What if size changes?
		// TODO What if gradient changes?

		// If color has changed, we need to re-initialize the cached image
		// that this light uses to render itself.
		if (this._dirty.color) {
			this._dirty.color = false;
			if (this.smooth) {
				this._initDrawing(this.radius * ig.system.scale);
			}
			else {
				this._initDrawing(this.radius);
				this.resize(ig.system.scale);
				this.drawingS = this.drawing.clone();
			}
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

	eraseFrom: function (ctx, color) {
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
				color = sh.util.canvas.RGBAtoCSS(color);
			}
			ctx.fillStyle = color;
			ctx.fillRect(x, y, w, h);
		}
	},

	getNearby: function () {
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

	isCoveredBy: function (entity) {
		var o = { x: this.pos.x + this.radius, y: this.pos.y + this.radius };
		return sh.util.math.geom.polyContains(entity._polygon, o);
	},

	_getShadow: function (entity, covered) {
		// The center/origin of this light
		var origin = {
			x: this.pos.x + this.radius,
			y: this.pos.y + this.radius
		};

		// Calculate the entity's bounding box, or "polygon", which is
		// computed based on the `opaque` property for most Entities inside
		// the getter function of each Entity's `_polygon` property.
		var poly = entity._polygon;

		// Does this polygon completely cover the light source?
		if (this.isCoveredBy(entity)) {
			covered.value = true;
			return [
				{ x: this.pos.x, y: this.pos.y },
				{ x: this.pos.x + this.size.x, y: this.pos.y },
				{ x: this.pos.x + this.size.x, y: this.pos.y + this.size.y },
				{ x: this.pos.x, y: this.pos.y + this.size.y }
			];
		}

		// Classify each point's position relative to the origin of this light.
		// The object `cl` is of the form { ul, ur, ll, lr }, where `ur` holds
		// the count (number) of points that were in the upper-left quadrant of
		// the light, `ur` the number in the upper-right, `ll` the number in
		// the lower-left, and `lr` the number in the lower-right.
		var cl = { ul: 0, ur: 0, ll: 0, lr: 0 };
		poly.forEach(function (pt) {
			//cl[(pt.y<origin.y?'u':'l')+(pt.x<origin.x?'l':'r')]++;
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

	drawShadow: function (ctx, entity) {
		var covered = { value: false };
		var shadow = this._getShadow(entity, covered);
		sh.util.canvas.fill(ctx, this.pos, shadow, 'black');
		return covered.value;
	},

	_drawShadows: function () {
		var nearby = this.getNearby();
		if (nearby.length === 0) {
			return;
		}

		// Setup
		this.drawingS = this.drawing.clone();
		var ctx = this.drawingS.ctx, fill = sh.util.canvas.fill;
		
		// Draw shadows
		var covered = false;
		for (var i = 0, len = nearby.length; i < len; i++) {
			if (this.drawShadow(ctx, nearby[i])) {
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
	}
});

// Entities must update their collision polygons for dynamic shadows
ig.Entity.inject({
	opaque: false,
	init: function () {
		this.parent.apply(this, arguments);
		Object.defineProperty(this, '_polygon', {
			get: function () {
				// TODO Could be optimized by mutating the same polygon, rather
				// than constructing a new one every time. Or it could be
				// be optimized by only running the calculation if the entity has
				// moved since the last calculation.
				var poly;
				if (this.opaque === true) {
					poly = [
						{ x: 0, y: 0 },
						{ x: this.size.x, y: 0 },
						{ x: this.size.x, y: this.size.y },
						{ x: 0, y: this.size.y }
					];
				} else {
					poly = this.opaque;
				}

				return poly.map(function (pt) {
					return { x: pt.x + this.pos.x, y: pt.y + this.pos.y };
				}.bind(this));
			}.bind(this)
		});
	}
});

// When the collision map is initialized, it should add each collision tile as
// a "fixed" object on the LightManager
ig.CollisionMap.inject({
	init: function () {
		this.parent.apply(this, arguments);

		// TODO Agglomerate many adjacent "pseudo-entities" into a single one.
		// For instance, many adjacent wall tile squares become a wall
		// rectangle.
		this.forEach(function (id, r, c) {
			var ent = this._makePseudoEntity(id, r, c);
			ent && sh.lightManager.addFixedEntity(ent);
		}.bind(this));
	},

	_makePolygon: function (tileId) {
		// Empty
		if (tileId === 0) {
			return null;
		}

		// Square
		if (tileId === 1) {
			// TODO Reuse the same object
			return [{ x: 0, y: 0 }, { x: 1, y: 0 },
				    { x: 1, y: 1 }, { x: 0, y: 1 }];
		}

		var def = this.tiledef[tileId];
		if (def == null) return null;
		var a = { x: def[0], y: def[1] }, b = { x: def[2], y: def[3] };

		// A line
		if (!def[4]) {
			return [a, b];
		}

		// Given a point `pt` which lies somewhere on the perimeter of the
		// "unit square" [(0,0),(1,0),(1,1),(0,1)], returns the next vertex
		// of the unit square that lies after `pt`, searching in the clockwise
		// direction starting at `pt`. For instance, if `pt` lies somewhere on
		// the upper edge [(0,0),(1,0)] of the unit square, the return value of
		// next(pt) will be the point representing the upper-right corner of
		// the unit circle, or { x: 1, y: 0 }. If `pt` is a vertex of the unit
		// square, next(pt) returns the next vertex (i.e., NOT `pt`).
		var next = function (pt) {
			if (pt.x === 0 && pt.y > 0) return { x: 0, y: 0 };
			if (pt.x < 1 && pt.y === 0) return { x: 1, y: 0 };
			if (pt.x === 1 && pt.y < 1) return { x: 1, y: 1 };
			if (pt.x > 0 && pt.y === 1) return { x: 0, y: 1 };
		};

		// Equality test for two points
		var eq = function (a, b) { return a.x === b.x && a.y === b.y; };

		// A filled polygon
		var poly = [a, b], tmp = b, stop = next(a);
		while (!(eq(tmp = next(tmp), a) || eq(tmp, stop))) {
			poly.push(tmp);
		}
		return poly;
	},

	_makePseudoEntity: function (id, r, c) {
		var poly = this._makePolygon(id);
		if (poly == null) {
			return null;
		}

		// Scale up and set position and size
		var obj = {
			pos: { x: c * this.tilesize, y: r * this.tilesize },
			size: { x: this.tilesize, y: this.tilesize }
		};
		obj._polygon = poly.map(function (pt) {
			return {
				x: obj.pos.x + pt.x * obj.size.x,
				y: obj.pos.y + pt.y * obj.size.y
			};
		});
		return obj;
	},

	forEach: function (cb) {
		this.data.forEach(function (row, r) {
			row.forEach(function (id, c) { cb(id, r, c); });
		});
	}
});

// Inject light management into the base framework
ig.Game.inject({
	lightManager: null,

	_tryInit: function () {
		if (this.lightManager == null) {
			sh.lightManager = this.lightManager = new sh.LightManager(this);
		}
	},

	// Whenever a light entity is spawned by the game, add it to the global
	// LightManager's list of lights.
	spawnEntity: function () {
		this._tryInit();
		var entity = this.parent.apply(this, arguments);
		if (entity instanceof sh.Light) {
			sh.lightManager.addLight(entity);
		}
		return entity;
	},

	// Render the light layer over top of whatever the game draws by default
	draw: function () {
		this._tryInit();
		this.parent.apply(this, arguments);
		sh.lightManager.draw();
	}
});

// Level editor tweaks
if (ig.global.wm) {
	sh.Light.inject({
		_wmScalable: true,

		init: function (x, y, settings) {
			this.parent(x, y, settings);
			this.size.x = this.size.y = Math.min(this.size.x, this.size.y);
		},

		draw: function () {
			if (this.scale !== ig.system.scale) {
				this.scale = ig.system.scale;
				var radius = Math.min(this.size.x, this.size.y) / 2;
				var size = radius * this.scale * 2;
				var img = this.currentAnim = new sh.Drawing({
					width: size,
					height: size
				});
				var color = ig.merge({ a: 0.1 }, this.color);
				img.ctx.fillStyle = sh.util.canvas.RGBAtoCSS(color);
				img.ctx.arc(size/2, size/2, size/2, 0, 2 * Math.PI, false);
				img.ctx.fill();
			}
			this.parent();
		}
	});
}

});