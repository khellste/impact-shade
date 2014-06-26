ig.module(
	'plugins.shade.util'
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

});