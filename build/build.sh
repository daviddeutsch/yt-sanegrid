#!/bin/bash

DIR="$( cd "$( dirname "$0" )" && pwd )"

cat $DIR/../js/app/googleapi.js \
	$DIR/../js/app/youtube.js \
	$DIR/../js/app/main.js \
	>> $DIR/../js/sanity.js

cat $DIR/../js/sanity.js \
	| uglifyjs -o \
	$DIR/../js/sanity.min.js \
	-c


# cat ../js/lib/underscore-min.js ../js/lib/gh3.js ../js/lib/jquery.easing.1.3.js ../js/lib/angular-strap.min.js ../js/lib/angular-strap.tpl.min.js ../js/lib/angular-cookies.js ../js/lib/angular-social.js ../js/lib/localStorage.js ../js/lib/localforage.min.js ../js/lib/angular-localForage.min.js ../js/lib/angular-ui-router.min.js | ../../UglifyJS/bin/uglifyjs -o ../js/sanity.min.js

