ig.module(
	'plugins.shade.light-manager'
).requires(
	'plugins.shade.light',
	'plugins.shade.drawing',
	'impact.entity',
	'impact.game',
	'impact.collision-map'
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
				return sh.util.canvas.colorToString(this.color);
			}.bind(this)
		});

		// Add a color property that, when changed, marks `_initialized` as
		// false
		sh.util.addColorProperty(this, function () {
			this._initialized = false;
		}.bind(this), this.color);
	},

	removeLight: function (light) {
		this.lights.erase(light);
		this._initialized = false;
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
		this.lights.forEach(function (light) { light._drawOn(scene); });
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
			if (light._needsRedraw()) {
				this.dirty.push(light);
				light._eraseFrom(this.scene, this.fillStyle);
			}
		}

		while (light = this.dirty.pop()) {
			light._drawOn(this.scene);
		}
	},

	draw: function () {

		// Render lights
		var ctx = ig.system.context;
		ctx.save();
		ctx.globalCompositeOperation = 'multiply';
		ctx.drawImage(this.scene.data, 0, 0);
		ctx.restore();
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
				}
				else {
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

		// For each solid object in the collision map, create a lightweight
		// "pseudo-entity" to add to the light manager. Pseudo-entities are
		// static collidable objects that have a `_polygon` property.
		this.forEach(function (id, r, c) {
			var ent = this._makePseudoEntity(id, r, c);
			ent && sh.lightManager.addFixedEntity(ent);
		}.bind(this));
	},

	// A mapping of tileId -> non-translated polygon
	_polyCache: { },

	// Like _makePolygonUncached, but caches the results
	_makePolygon: function (tileId) {
		var cached = this._polyCache[tileId];
		if (cached !== undefined) {
			return cached;
		}
		return this._polyCache[tileId] = this._makePolygonUncached(tileId);
	},

	// Create a non-translated polygon (array of {x,y} points) describing the
	// boundary of a collision tile with the provided ID
	_makePolygonUncached: function (tileId) {

		// Empty collision tile
		if (tileId === 0) {
			return null;
		}

		// Square tile
		if (tileId === 1) {
			return [{ x: 0, y: 0 }, { x: 1, y: 0 },
					{ x: 1, y: 1 }, { x: 0, y: 1 }];
		}

		// Undefined collision tile type
		var def = this.tiledef[tileId];
		if (def == null) {
			return null;
		}

		// Parse the tile definition
		var a = { x: def[0], y: def[1] },
			b = { x: def[2], y: def[3] };

		// A line
		if (!def[4]) {
			return [a, b];
		}

		// Given a point `pt` which lies somewhere on the perimeter of the
		// "unit square" [(0,0),(1,0),(1,1),(0,1)], returns the next vertex
		// of the unit square that lies after `pt`, searching in the clockwise
		// direction starting at `pt`. If `pt` is a vertex of the unit square,
		// next(pt) returns the next vertex (i.e., NOT `pt`).
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
		sh.lightManager.update();
		sh.lightManager.draw();
	}
});

});