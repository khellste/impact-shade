ig.module(
	'plugins.shade.util.canvas'
).requires(
	//'imipact.system'
).defines(function () {
window.sh = window.sh || {};
sh.util = sh.util || {};
sh.util.canvas = sh.util.canvas || {};

sh.util.canvas.RGBtoCSS = function (rgb) {
	var r = rgb.r || 0, g = rgb.g || 0, b = rgb.b || 0;
	return 'rgb(' + [r, g, b].join(',') + ')';
};

sh.util.canvas.RGBAtoCSS = function (rgba) {
	var r = rgba.r || 0, g = rgba.g || 0, b = rgba.b || 0,
		a = rgba.a != null ? rgba.a : 1;
	return 'rgba(' + [r, g, b, a].join(',') + ')';
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