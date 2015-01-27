var through = require('through2');
var gutil = require('gulp-util');
var File = gutil.File;
var PluginError = gutil.PluginError;
var path = require('path');
var convSM = require('convert-source-map');

var PLUGIN_NAME = 'gulp-extract-sourcemap';

function extract(opts) {
	if (!opts) {
		opts = {};
	}

	return through.obj(function (file, enc, cb) {
		var sMap = '';
		if (!file.isNull()) {
			var src = file.contents.toString('utf8');
			var i, match;
			var sMapFileName = opts.sourceMappingFileName ? path.basename(opts.sourceMappingFileName) : ( path.basename(file.path) + '.map' );

			var pos = src.indexOf('//# sourceMappingURL=data:application/json;base64,');
			if (!~pos) {
				pos = src.indexOf('//@ sourceMappingURL=data:application/json;base64,');
			}

			if (~pos) {
				try {
					sMap = convSM.fromComment(src).toJSON();
				} catch (x) {
					this.emit('error', new PluginError(PLUGIN_NAME, x));
					sMap = '';
				}

				src = src.substr(0, pos);
			}

			if (sMap) {
				try {
					sMap = JSON.parse(sMap);
				} catch (x) {
					this.emit('error', new PluginError(PLUGIN_NAME, x));
					sMap = '';
				}

				if (sMap && opts.removeSourcesContent && sMap.sourcesContent) {
					delete sMap.sourcesContent;
				}
				// unfuck: allow absolute source map urls if basedir not specified //
				if (sMap && sMap.sources) {
					if (opts.truncate) {
						//var basedir = opts.basedir || file.cwd || process.cwd();
						for (i = sMap.sources.length; i--;) {
							match = /[\/\\]([^\/\\]*\w+\.\w+[\/\\].+?)$/.exec(sMap.sources[i]);
							if (match) {
								sMap.sources[i] = opts.prefix ? opts.prefix + match[1] : match[1];
							} else {
								sMap.sources[i] = opts.prefix ? opts.prefix + path.basename(sMap.sources[i]) : path.basename(sMap.sources[i]);

							}
						}
					} else {
						if (opts.basedir !== undefined) {
							var basedir = opts.basedir || file.cwd || process.cwd();
							for (i = sMap.sources.length; i--;) {
								sMap.sources[i] = path.relative(basedir, sMap.sources[i]);
							}
						}
					}
				}
			}
			if (sMap) {
				this.push(new File({
					cwd:      file.cwd,
					base:     file.base,
					// unfuck: ensure source map is in the same location as the file - not the root! //
					path:     path.join(path.dirname(file.path), sMapFileName),
					contents: new Buffer(JSON.stringify(sMap))
				}));
				src += '//# sourceMappingURL=' + (opts.sourceMappingFileName || sMapFileName);
			}

			file.contents = new Buffer(src);
		}
		this.push(file);
		this.emit('postextract', sMap);
		cb();
	});
}

module.exports = extract;