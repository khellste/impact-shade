ig.module(
	'plugins.shade.util'
).requires(
	'plugins.shade.util.canvas'
).defines(function () {
window.sh = window.sh || {};
sh.util = sh.util || {};

sh.util.bool = function (val, defalt) {
	defalt = defalt || false;
	switch (typeof val) {
		case 'boolean':
			return val;
		case 'string':
			return val === 'true' ? true : val === 'false' ? false : defalt;
		case 'number':
			return val === 0 ? false : true;
		case 'object':
			if (val instanceof Boolean || val instanceof String  ||
										  val instanceof Number) {
				return sh.util.bool(val.valueOf(), defalt);
			}
			return !!val;
		case 'function':
			return true;
		default:
			return defalt;
	}
};

// Add a property with the name "color" to object `object` that acts as a
// color. The property has `r`, `g`, and `b` properties, and makes sure each
// of these stays within the range [0,255]. When either the whole color or
// any of its properties changes (i.e., gets a new value that is different
// from its previous value), `onChange` is called.
sh.util.addColorProperty = function (object, onChange, initVal) {
	var color = { }, r = initVal.r, g = initVal.g, b = initVal.b;
	Object.defineProperty(object, 'color', {
		enumerable: true,
		get: function () {
			return color;
		},
		set: function (col) {
			if (typeof col === 'string') {
				col = sh.util.canvas.stringToColor(col);
			}
			color.r = col.r;
			color.g = col.g;
			color.b = col.b;
			onChange();
		}
	});
	Object.defineProperties(color, {
		r: {
			enumerable: true,
			get: function () { return r; },
			set: function (val) {
				if (val === r) return;
				else if (val <   0) val = 0;
				else if (val > 255) val = 255;
				r = val;
				onChange();
			}
		},
		g: {
			enumerable: true,
			get: function () { return g; },
			set: function (val) {
				if (val === g) return;
				else if (val <   0) val = 0;
				else if (val > 255) val = 255;
				g = val;
				onChange();
			}
		},
		b: {
			enumerable: true,
			get: function () { return b; },
			set: function (val) {
				if (val === b) return;
				else if (val <   0) val = 0;
				else if (val > 255) val = 255;
				b = val;
				onChange();
			}
		}
	});
};

});