ig.module(
	'plugins.shade.drawing'
).requires(
	'impact.image'
).defines(function () { "use strict";
window.sh = window.sh || {};

sh.Drawing = ig.Image.extend({
	loaded: true,
	ctx: null,
	cache: {}, // Caches scaled versions of this image
	scale: 1,  // The current (absolute) scale of this image
	caching: false,

	init: function (settings) {
		ig.merge(this, settings);

		// Create the canvas that holds the drawing
		this.data = ig.$new('canvas');
		this.data.width = this.width;
		this.data.height = this.height;
		this.data.retinaResolutionEnabled = false;

		// Initialize the scaling mode
		this.ctx = this.data.getContext('2d');
		ig.System.scaleMode(this.data, this.ctx);

		// Store the base image in the cache
		this.cache[1] = this.data;
	},

	clone: function () {
		var clone = new sh.Drawing({ height: this.height, width: this.width });
		clone.ctx.drawImage(this.data, 0, 0);
		return clone;
	},

	draw: function (x, y) {
		this.parent(x, y, 0, 0, this.width, this.height);
	},

	resize: function (scale, absolute) {
		if (this.caching) {
			this.cache[this.scale] = this.data;
		}

		// The requested `scale` relative to the initial size
		// (the scale used to index into the cache)
		var absScale = absolute ? scale : scale * this.scale;

		// Does this resize cause any change?
		if (this.scale === absScale) return;

		// Try cache lookup
		if (this.cached && this.cache[absScale] != null) {
			this.data = this.cache[absScale];
			this.ctx = this.data.getContext('2d');
			this.scale = absScale;
		}

		// Cache lookup failed
		else {
			this.data = this.cache[1];
			this.parent(absScale);
			this.ctx = this.data.getContext('2d');
			this.scale = absScale;
			this.cache[absScale] = this.data;
		}

		// Update width and height
		this.width = this.cache[1].width * this.scale;
		this.height = this.cache[1].height * this.scale;
	},

	load:   function () {},
	reload: function () {},
	onload: function () {}
});

});