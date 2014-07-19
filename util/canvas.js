ig.module(
	'plugins.shade.util.canvas'
).requires(
	'impact.system'
).defines(function () {
window.sh = window.sh || {};
sh.util = sh.util || {};
sh.util.canvas = sh.util.canvas || {};

// A test canvas to draw colors on
var testCtx = (function (ig) {
	var canvas = ig.$new('canvas');
	canvas.width = canvas.height = 1;
	return canvas.getContext('2d');
})(ig);

// Convert a CSS color string to an RGB(A) object. The provided string must be
// recognized by the browser for this to work.
sh.util.canvas.stringToColor = function (str) {
	testCtx.fillStyle = str;
	testCtx.fillRect(0, 0, 1, 1);
	var data = testCtx.getImageData(0, 0, 1, 1).data;
	return { r: data[0], g: data[1], b: data[2], a: data[3] };
};

// Convert an RGB(A) string to an 'rgb(#,#,#)' or 'rgba(#,#,#,#)' CSS string.
sh.util.canvas.colorToString = function (obj) {
	var r = obj.r || 0, g = obj.g || 0, b = obj.b || 0, a = obj.a || 0;
	if (typeof obj.a !== 'undefined') {
		return 'rgba(' + [r, g, b, a].join(',') + ')';
	}
	return 'rgb(' + [r, g, b].join(',') + ')';
};

sh.util.canvas.makeRadialGradient = function (r, colors) {
	var grad = ig.system.context.createRadialGradient(r, r, 0, r, r, r);
	var nDivisions = colors.length - 1;
	colors.forEach(function (col, i) {
		if (typeof col === 'object') {
			col = sh.util.canvas.RGBAtoCSS(col);
		}
		grad.addColorStop(i / nDivisions, col);
	});
	return grad;
};

sh.util.canvas.trace = function (ctx, pos, points, scale) {
	scale = scale || ig.system.scale;
	ctx.beginPath();
	var last = points[points.length-1];
	last && ctx.moveTo(
		Math.round((last.x - pos.x) * scale),
		Math.round((last.y - pos.y) * scale)
	);
	points.forEach(function (pt) {
		ctx.lineTo(
			Math.round((pt.x - pos.x) * scale),
			Math.round((pt.y - pos.y) * scale)
		);
	});
};

sh.util.canvas.fill = function (ctx, pos, points, style, scale) {
	sh.util.canvas.trace(ctx, pos, points, scale);
	ctx.fillStyle = style;
	ctx.fill();
};

sh.util.canvas.outline = function (ctx, pos, points, style, scale) {
	sh.util.canvas.trace(ctx, pos, points, scale);
	ctx.strokeStyle = style;
	ctx.stroke();
};

});