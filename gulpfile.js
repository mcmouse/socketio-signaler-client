/* globals require */
/* jshint node:true */
'use strict';

var gulp = require('gulp'),
  browserify = require('browserify'),
  uglify = require('gulp-uglify'),
  source = require('vinyl-source-stream'),
  rename = require('gulp-rename');

function logError(error) {
  console.log(error);
}

var config = {
  inputFile: './src/signaler-client.js',
  minFile: 'signaler-client.min.js',
  pkgdFile: 'signaler-client.pkgd.js',
  pkgdMinFile: 'signaler-client.pkgd.min.js',
  dest: './dist',
};

gulp.task('dev', [], function () {
  gulp.src(config.inputFile)
    .pipe(gulp.dest(config.dest));
});

gulp.task('min', [], function () {
  gulp.src(config.inputFile)
    .pipe(rename(config.minFile))
    .pipe(uglify())
    .pipe(gulp.dest(config.dest));
});

gulp.task('build', [], function () {
  browserify(config.inputFile)
    .bundle()
    .on('error', logError)
    .pipe(source(config.pkgdFile))
    .pipe(gulp.dest(config.dest));
});

gulp.task('prod', [], function () {
  browserify(config.inputFile)
    .transform('uglifyify', {
      global: true
    })
    .bundle()
    .on('error', logError)
    .pipe(source(config.pkgdMinFile))
    .pipe(gulp.dest(config.dest));
});

gulp.task('default', ['dev', 'min', 'build', 'prod']);