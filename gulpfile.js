'use strict';

var gulp 					= require('gulp');
var del 					= require('del');
var gutil 				= require('gulp-util');
var exec 					= require('child_process').exec;
var argv 					= require('yargs').argv;
var sass 					= require('gulp-sass');
var notify 				= require('gulp-notify');
var postcss 			= require('gulp-postcss');
var autoprefixer 	= require('autoprefixer');
var browserSync 	= require('browser-sync');
var imagemin 			= require('gulp-imagemin');
var rename 				= require('gulp-rename');
var connect       = require('gulp-connect-php');
var php2html      = require("gulp-php2html");
var sourcemaps 		= require('gulp-sourcemaps');

var production = !!argv.production;
var build = argv._.length ? argv._[0] === 'build' : false;

// gulp error message
var handleError = function(task) {
	return function(err) {
		notify.onError({ message: task + ' failed, check the logs..', sound: false })(err);
		gutil.log(gutil.colors.bgRed(task + ' error:'), gutil.colors.red(err));
	};
};

var origSrc = gulp.src;
gulp.src = function () {
	return fixPipe(origSrc.apply(this, arguments));
};
function fixPipe(stream) {
	var origPipe = stream.pipe;
	stream.pipe = function (dest) {
		arguments[0] = dest.on('error', function (error) {
			var nextStreams = dest._nextStreams;
			if (nextStreams) {
				nextStreams.forEach(function (nextStream) {
					nextStream.emit('error', error);
				});
			} else if (dest.listeners('error').length === 1) {
				throw error;
			}
		});
		var nextStream = fixPipe(origPipe.apply(this, arguments));
		(this._nextStreams || (this._nextStreams = [])).push(nextStream);
		return nextStream;
	};
	return stream;
}

var tasks = {
	clean: function(cb) { del(['./'], cb); },
	sass: function() {
		return gulp.src('./source/assets/sass/**/*.scss')
		 // .pipe(sourcemaps.init())
			.pipe(sass({ outputStyle: production ? 'compressed' : 'compressed' }))
			.on('error', handleError('SASS'))
			.pipe(postcss([autoprefixer({browsers: ['last 3 versions']})]))
			.pipe(rename({suffix: '.min'}))
			// .pipe(sourcemaps.write())
		.pipe(gulp.dest('./dist/assets/css'));
	},
	php2html: function() {
		return gulp.src("./dist/*.php")
			.pipe(php2html())
			.pipe(gulp.dest("./html"));
	},
	optimize: function() {
		return gulp.src('./source/assets/img/*.{gif,jpg,png,svg}')
			.pipe(imagemin({
				progressive: true,
				svgoPlugins: [{removeViewBox: false}],
				optimizationLevel: production ? 3 : 1
			}))
			.pipe(gulp.dest('./dist/assets/img/'));
	}
};

gulp.task('browser-sync', function() {
	  connect.server({}, function (){
		    browserSync({
          proxy: 'localhost:8000',
          port: 8001,
          startPath: './dist/'
        });
		});
});


gulp.task('reload-sass', ['sass'], function(){ browserSync.reload(); });

gulp.task('clean', tasks.clean);
var req = build ? ['clean'] : [];

gulp.task('sass', req, tasks.sass);
// gulp.task('php2html', tasks.php2html);
gulp.task('optimize', tasks.optimize);

gulp.task('watch', ['sass', /* 'php2html', */  'optimize', 'browser-sync'], function(){
	gulp.watch('./source/assets/sass/**/*.scss', ['reload-sass']);
	gulp.watch('./dist/**/*.php', ['reload-sass']);
	gulp.watch('vendor/' + ['bower.json', '.bowerrc'], ['bower']);
});
gulp.task('build', ['clean', 'sass',]);
gulp.task('default', ['watch']);