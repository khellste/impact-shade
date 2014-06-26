ig.module(
	'plugins.shade.util.math.geom'
).defines(function () {
window.sh = window.sh || {};
sh.util = sh.util || {};
sh.util.math = sh.util.math || {};
sh.util.math.geom = sh.util.math.geom || {};

sh.util.math.geom.projVert = function (a, b, x, ignoreBackwards) {
	if (typeof ignoreBackwards !== 'boolean') {
		ignoreBackwards = true;
	}
	var pos = a, dir = { x: b.x - a.x, y: b.y - a.y };
	if (dir.x === 0) return null;
	var t = (x - pos.x)/dir.x;
	if (ignoreBackwards && t < 0) return null;
	return pos.y + t * dir.y;
};

sh.util.math.geom.projHorz = function (a, b, y, ignoreBackwards) {
	if (typeof ignoreBackwards !== 'boolean') {
		ignoreBackwards = true;
	}
	var pos = a, dir = { x: b.x - a.x, y: b.y - a.y };
	if (dir.y === 0) return null;
	var t = (y - pos.y)/dir.y;
	if (ignoreBackwards && t < 0) return null;
	return pos.x + t * dir.x;
};

sh.util.math.geom.polyContains = function (points, test) {
	var len = points.length, res = false;
	for (var i = 0, j = len - 1; i < len; j = i++) {
		var pi = points[i], pj = points[j];
		if ((pi.y > test.y) !== (pj.y > test.y) &&
			(test.x < (pj.x - pi.x) * (test.y - pi.y) / (pj.y - pi.y) + pi.x)) {
			res = !res;
		}
	}
	return res;
};

});