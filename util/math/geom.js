ig.module(
	'plugins.shade.util.math.geom'
).defines(function () {
window.sh = window.sh || {};
sh.util = sh.util || {};
sh.util.math = sh.util.math || {};
sh.util.math.geom = sh.util.math.geom || {};

sh.util.math.geom.projVert = function (a, b, x) {
	var pos = a, dir = { x: b.x - a.x, y: b.y - a.y };
	if (dir.x === 0) return null;
	var t = (x - pos.x)/dir.x;
	return (t < 0) ? null : (pos.y + t * dir.y);
};

sh.util.math.geom.projHorz = function (a, b, y) {
	var pos = a, dir = { x: b.x - a.x, y: b.y - a.y };
	if (dir.y === 0) return null;
	var t = (y - pos.y)/dir.y;
	return (t < 0) ? null : (pos.x + t * dir.x);
};

// TODO Clean up this method to make fewer comparisons
sh.util.math.geom.polyContains = function (points, test) {
	var len = points.length, res = false;
	for (var i = 0, j = len - 1; i < len; j = i++) {
		var pi = points[i], pj = points[j];
		if ((pi.x > test.x) !== (pj.x > test.x) && pi.y === pj.y && pi.y === test.y) {
			return true;
		}
		if ((pi.y > test.y) !== (pj.y > test.y)) {
			if (pi.x === pj.x && pi.x === test.x) {
				return true;
			}
			if ((test.x < (pj.x - pi.x) * (test.y - pi.y) / (pj.y - pi.y) + pi.x)) {
				res = !res;
			}
		}
	}
	return res;
};

});