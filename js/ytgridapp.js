var sanityApp = angular.module(
	"sanityApp",
	[
		'ngAnimate', 'ui.bootstrap', 'ngSocial',
		'localStorage', 'LocalForageModule'
	]
);

sanityApp.config(
[
'$localForageProvider',
function( $localForageProvider ) {
	$localForageProvider.config({
		name        : 'SanityGrid',
		version     : 1.0,
		storeName   : 'default',
		description : 'The grid for people who like to stay sane'
	});
}
]
);

sanityApp.run(
[
'$rootScope', 'googleApi',
function( $rootScope, googleApi ) {
	$rootScope.apiReady = true;

	if ( $.isEmptyObject( $rootScope.settings ) ) {
		$rootScope.settings = {
			hidewatched: false,
			hidemuted:   true,
			theme:       'default'
		};
	}

	if ( typeof $rootScope.videos == 'object' ) {
		$rootScope.videos = [];
	}

	if ( $.isEmptyObject( $rootScope.channelstate ) ) {
		$rootScope.channelstate = {};
		$rootScope.channelstate.hidden = {};
		$rootScope.channelstate.zipped = {};
	}

	if ( $.isEmptyObject( $rootScope.filters ) ) {
		$rootScope.filters = {};
		$rootScope.filters.count = 0;
		$rootScope.filters.caught = 0;
		$rootScope.filters.global = [];
		$rootScope.filters.channels = {};
	}

	if ( typeof $rootScope.filters.global == 'undefined' ) {
		$rootScope.filters = {};
		$rootScope.filters.count = 0;
		$rootScope.filters.caught = 0;
		$rootScope.filters.global = [];
		$rootScope.filters.channels = {};
	}

	if ( $.isArray( $rootScope.videocache ) ) {
		$rootScope.videocache = {};
	}

	if ( typeof $rootScope.settings.adblocksecret == 'undefined' ) {
		$rootScope.settings.adblocksecret = Math.random().toString(36).substr(2);

		$rootScope.settings.adblockoverride = false;
	}

	if ( typeof $rootScope.settings.videolimit == 'undefined' ) {
		$rootScope.settings.videolimit = 100;
	}
}
]
);

sanityApp.controller('AppRepeatCtrl',
[
'$rootScope', '$scope', '$q', '$store', '$document', 'ytApp', 'googleApi', 'ytData', 'appLoading',
function ( $rootScope, $scope, $q, $store, $document, ytApp, googleApi, ytData, appLoading ) {

	$scope.start = true;

	//$store.bind( $rootScope, 'userid', '' );
	$store.bind( $rootScope, 'videocache', {} );
	//$store.bind( $rootScope, 'videos', [] );
	$store.bind( $rootScope, 'settings', {} );
	$store.bind( $rootScope, 'channelstate', {} );
	$store.bind( $rootScope, 'filters', {} );

	$scope.videos = [];
	$rootScope.userid = '';

	var accounts = [];

	var httpError = function ( status ) {
		if ( status == 403 ) {
			$scope.forbidden = 1;
		} else {
			$scope.notfound = 1;
		}

		appLoading.ready();
	};

	var initAccount = function () {
		$scope.start = false;

		$rootScope.settings.sidebar = false;

		$scope.channels = [];
		$scope.channelids = [];

		mainChannel()
			.then(function(id) {
				$rootScope.userid = id;

				syncChannels()
					.then(function() {
						loadVideos()
							.then(function(count) {
								// TODO: display count
								appLoading.ready();
							});
					});
			});
	};

	var mainChannel = function(page) {
		var deferred = $q.defer();

		if ( typeof page == 'undefined' ) {
			page = null;
		}

		ytData.channels()
			.then(function(data) {
				accounts.push({
					id: data.items[0].id,
					title: data.items[0].snippet.title
				});

				deferred.resolve(data.items[0].id);
			});

		return deferred.promise;
	};

	var loadVideos = function() {
		var deferred = $q.defer();

		var count = 0;

		var len = $scope.channels.length - 1;

		for ( var i = 0; i < $scope.channels.length; i++ ) {
			channelVideos($scope.channels[i].channelId)
				.then(function(entries) {
					count += entries;

					if ( i === len ) {
						deferred.resolve(count);
					}
				}(i));
		}

		return deferred.promise;
	};

	var channelVideos = function( channel ) {
		var deferred = $q.defer();

		ytData.channelvideos( channel )
			.then(function(data) {
				pushVideos(data.items)
					.then(function() {
						deferred.resolve(count);
					});
			});

		return deferred.promise;
	};

	var pushVideos = function ( data ) {
		var deferred = $q.defer();

		if ( typeof data != 'undefined' ) {
			extractVideoIds(data)
				.then(function(ids){
					pushVideoIds(ids)
						.then(function(count){
							deferred.resolve(count);
						});
				});
		} else {
			deferred.reject();
		}

		return deferred.promise;
	};

	var extractVideoIds = function ( array ) {
		var deferred = $q.defer();

		var list = [];

		var len = array.length - 1;

		for ( var i = 0; i < array.length; i++ ) {
			if ( typeof array[i].contentDetails == 'undefined' ) continue;

			if ( typeof array[i].contentDetails.upload != 'undefined' ) {
				list.push(array[i].contentDetails.upload.videoId);

				if ( i === len ) {
					deferred.resolve(list);
				}
			} else if ( i === len ) {
				deferred.resolve(list);
			}
		}

		return deferred.promise;
	};

	var pushVideoIds = function ( list ) {
		var deferred = $q.defer();

		ytData.videos( list )
			.then(function(data) {
				var len = data.items.length - 1;

				var count = 0;

				for ( var i = 0; i < data.items.length; i++ ) {
					if ( pushVideo(data.items[i]) ) {
						count++;
					}

					if ( i === len ) {
						deferred.resolve(count);
					}
				}
			});

		return deferred.promise;
	};

	var pushVideo = function ( video ) {
		var details = {
			id:          video.id,
			hash:        video.id,
			link:        'https://www.youtube.com/watch?v=' + video.id,
			title:       video.snippet.title,
			thumbnail:         {
				default: video.snippet.thumbnails.default,
				medium: video.snippet.thumbnails.medium,
				high: video.snippet.thumbnails.high
			},
			authorid:    video.snippet.channelId,
			author:      video.snippet.channelTitle,
			authorlink:  'https://www.youtube.com/channel/' + video.snippet.channelId,
			published:   video.snippet.publishedAt,
			duration:    video.contentDetails.duration
		};

		var existing = false;

		var eid = 0;

		$.each( $scope.videos, function ( i, v ) {
			if ( $scope.videos[i].hash == video.id ) {
				existing = true;

				eid = i;
			}
		} );

		if ( existing ) {
			// Update existing data
			$.each(
				[
					'id', 'link', 'title', 'img', 'authorid',
					'author', 'authorlink', 'published', 'duration'
				],
				function ( i, v ) {
					$scope.videos[eid][v] = details[v];
				}
			);

			return null;
		} else {
			$scope.videos.push( details );

			return true;
		}
	};

	var checkList = function() {
		var len = $rootScope.videos.length;

		for ( i=0; i<len; i++ ) {
			// Upgrade old style list where id was the hash
			if ( typeof $rootScope.videos[i].hash == 'undefined' ) {
				$rootScope.videos[i].hash = $rootScope.videos[i].id;
			}

			// Remove hashKey if it has been stored by accident
			if ( typeof $rootScope.videos[i].$$hashKey != 'undefined' ) {
				delete $rootScope.videos[i].$$hashKey;
			}

			// Lazy way to prevent dupes
			$rootScope.videos[i].id = i;

			// Upgrade old format where we didn't have watched and muted
			if ( typeof $rootScope.videos[i].watched == 'undefined' ) {
				$rootScope.videos[i].watched = $rootScope.videos[i].muted;
				$rootScope.videos[i].muted = false;
			}
		}
	};

	var syncChannels = function(page)
	{
		var deferred = $q.defer();

		if ( typeof page == 'undefined' ) {
			page = null;
		}

		ytData.subscriptions(page)
			.then(function(data){
				loadChannels(data)
					.then(function() {
						deferred.resolve();
					});
			});

		return deferred.promise;
	};

	var loadChannels = function ( data ) {
		var deferred = $q.defer();

		if ( typeof data.items != 'undefined' ) {
			appendChannels(data.items)
				.then(function() {
					if ( $scope.channels.length < data.pageInfo.totalResults ) {
						syncChannels(data.nextPageToken)
							.then(function() {
								deferred.resolve();
							})
					} else {
						deferred.resolve();
					}
				});
		} else {
			deferred.resolve();
		}

		return deferred.promise;
	};

	var appendChannels = function ( items )
	{
		var deferred = $q.defer();

		var len = items.length-1;

		for ( var i = 0; i < items.length; i++ ) {
			if ( $.inArray( items[i].id, $scope.channelids ) ) {
				$scope.channels.push(
					{
						id: items[i].id,
						title: items[i].snippet.title,
						description: items[i].snippet.description,
						channelId: items[i].snippet.resourceId.channelId
					}
				);

				$scope.channelids.push(items[i].id);
			}

			if ( i === len ) {
				deferred.resolve();
			}
		}

		return deferred.promise;
	};

	var resetErrors = function () {
		if ( $scope.forbidden == 1 || $scope.notfound == 1 ) {
			appLoading.loading();

			$scope.forbidden = 0;
			$scope.notfound = 0;

			appLoading.ready();
		}
	};

	var loadTop = function () {
		resetErrors();

		appLoading.loading();

		$rootScope.filters.caught = 0;

		loadVideos();
	};

	var updateSidebar = function () {
		if ( $rootScope.settings.sidebar === true ) {
			$('.sidebar' ).css({"height":$document.height()});
		} else {
			$('.sidebar' ).css({"height":"40px"});
		}
	};

	var migrateOldLS = function() {
		// Find the old userid
		// Convert old properties to new
		// - Thumbnail
		// - Duration
		// Sort into right container
	};

	$scope.selectUserid = function ( q ) {
		if ( q === false ) {
			$scope.start = true;
		} else {
			initAccount( q );

			//loadTop();
		}
	};

	$scope.refresh = function() {
		appLoading.loading();

		ytApp.update();

		loadTop();
	};

	$scope.hideChannel = function ( name ) {
		var pos = $.inArray( name, $rootScope.channeloptions.hidden );

		if ( pos != -1 ) {
			$rootScope.channeloptions.hidden = $rootScope.channeloptions.hidden.splice(pos, 1);
		} else {
			$rootScope.channeloptions.hidden.push(name);
		}
	};

	$scope.togglesidebar = function () {
		$rootScope.settings.sidebar = !$rootScope.settings.sidebar;

		updateSidebar();
	};

	$scope.videoFilter = function (video) {
		if ( ( (video.muted && ($rootScope.settings.hidemuted == "1")) || (video.watched && ($rootScope.settings.hidewatched == "1")) ) ) {
			return null;
		}

		var auth = video.authorlink.split("/");
		var key = auth[auth.length-1].toLowerCase();

		if ( $rootScope.channelstate.hidden[key] === "1" ) {
			return null;
		}

		var filtered = false;

		$.each( $rootScope.filters.global, function ( i, v ) {
			if ( video.title.indexOf( v.string ) != -1 ) {
				filtered = true;
			}
		});

		if ( !filtered && $rootScope.filters.channels.hasOwnProperty(video.authorid) ) {
			$.each( $rootScope.filters.channels[video.authorid].filters, function ( i, v ) {
				if ( video.title.indexOf( v.string) != -1 ) {
					filtered = true;
				}
			});
		}

		if ( filtered ) {
			$rootScope.filters.caught++;

			video.muted = true;

			return null;
		}

		return video;
	};

	$scope.connect = function()
	{
		googleApi.authorize()
			.then(function(){
				initAccount();

				//checkList();

				//loadTop();

				updateSidebar();
			});
	};

	angular.element($document).bind("keyup", function(event) {
		if (event.which === 82) $scope.refresh();
	});

	if ( $rootScope.userid ) {
		$scope.start = false;

		$rootScope.settings.sidebar = false;

		googleApi.checkAuth()
			.then(function(){
				initAccount();

				//checkList();

				//loadTop();

				updateSidebar();
			});
	}
}
]
);

sanityApp.directive('videoItem',
	function($timeout) {
	return {
		restrict: 'C',
		scope: {
			video: '='
		},
		templateUrl: 'templates/item.html',
		controller: function( $scope, $rootScope ) {
			$scope.mute = function () {
				$scope.video.muted = !$scope.video.muted;
				$scope.video.muteddate = new Date().toISOString();
			};

			$scope.watch = function ( $event ) {
				if ( ($event.button == 2) ) {
					return;
				}

				$timeout(function(){$scope.watched(false);}, 400);
			};

			if ( $rootScope.settings.adblockoverride ) {
				$scope.link = $scope.video.link+"&adblock="+$rootScope.settings.adblocksecret;
			} else {
				$scope.link = $scope.video.link;
			}

			$scope.watched = function ( force ) {
				if ( $scope.video.watched && !force ) {
					return;
				}

				$scope.video.watched = !$scope.video.watched;
				$scope.video.watcheddate = new Date().toISOString();
			};
		}
	}
});

sanityApp.controller('VideoListCtrl',
[
'$scope', '$rootScope',
function ($scope, $rootScope) {
	$scope.setLimit = function (increment) {
		$rootScope.settings.videolimit =
			Number($rootScope.settings.videolimit) + Number(increment)
		;

		if ( $rootScope.settings.videolimit < 1 ) {
			$rootScope.settings.videolimit = 5;
		}
	};

	var getPercentage = function () {
		if ( $rootScope.settings.videolimit < $rootScope.videos.length ) {
			$scope.percentage = parseInt(100 * $rootScope.settings.videolimit / $rootScope.videos.length);

			$scope.abslength = $rootScope.settings.videolimit;
		} else {
			$scope.percentage = 100;

			$scope.abslength = $rootScope.videos.length;
		}
	};

	$rootScope.$watch('videos', getPercentage, true);

	$rootScope.$watch('settings', getPercentage, true);

	$scope.percentage = getPercentage();
}
]
);




sanityApp.controller('SettingsModalCtrl',
[
'$scope', '$store', '$modal',
function ($scope, $store, $modal) {
	$scope.open = function () {
		var modalInstance = $modal.open({
			templateUrl: 'templates/settings.html',
			backdrop: false,
			dialogFade:true,
			controller: 'SettingsModalInstanceCtrl',
			scope: $scope
		});
	};
}
]
);

sanityApp.controller('SettingsModalInstanceCtrl',
[
'$rootScope', '$scope', '$store', '$modalInstance',
function ($rootScope, $scope, $store, $modalInstance) {
	$store.bind( $rootScope, 'filters', {} );

	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};

	$scope.redoadblocksecret = function () {
		$rootScope.settings.adblocksecret = Math.random().toString(36).substr(2);
	};

	$scope.removeFilter = function (channel, id) {
		if ( channel.length ) {
			$rootScope.filters.channels[channel].filters.splice(id,1);

			if ( $rootScope.filters.channels[channel].filters.length === 0 ) {
				delete $rootScope.filters.channels[channel];
			}
		} else {
			$rootScope.filters.global.splice(id,1);
		}

		$rootScope.filters.count--;
	};
}
]
);

sanityApp.controller('SupportModalCtrl',
[
'$scope', '$modal',
function ($scope, $modal) {
	$scope.open = function () {
		var modalInstance = $modal.open({
			templateUrl: 'templates/support.html',
			backdrop: false,
			dialogFade:true,
			controller: 'SupportModalInstanceCtrl'
		});
	};
}
]
);

sanityApp.controller('SupportModalInstanceCtrl',
[
'$scope', '$modalInstance',
function ($scope, $modalInstance) {
	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};
}
]
);

sanityApp.controller('FilterModalCtrl',
[
'$scope', '$store', '$modal',
function ($scope, $store, $modal)
{
	$scope.open = function (video) {
		var modalInstance = $modal.open({
			templateUrl: 'templates/filter.html',
			backdrop: false,
			dialogFade:true,
			controller: 'FilterModalInstanceCtrl',
			scope: $scope,
			resolve: {
				item: function () {
					return video;
				}
			}
		});
	};
}
]
);

sanityApp.controller('FilterModalInstanceCtrl',
[
'$rootScope', '$scope', '$store', '$modalInstance', 'item',
function ($rootScope, $scope, $store, $modalInstance, item)
{
	if ( item.authorid ) {
		$scope.filter = {
			title: item.title,
			channel: item.authorid,
			author: item.author,
			authorid: item.authorid
		};
	} else {
		$scope.filter = {
			title: item.title,
			channel: item.author,
			author: item.author,
			authorid: item.author
		};
	}


	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};

	$scope.ok = function (item) {
		$store.bind( $rootScope, 'filters', {} );

		if ( $scope.filter.channel.length ) {
			if ( typeof $rootScope.filters.channels[$scope.filter.channel] == 'undefined' ) {
				$rootScope.filters.channels[$scope.filter.channel] = {
					title: $scope.filter.channel,
					filters: []
				};
			}

			$rootScope.filters.channels[$scope.filter.channel].filters.push({string:$scope.filter.title});
		} else {
			$rootScope.filters.global.push({string:$scope.filter.title});
		}

		$rootScope.filters.count++;

		$modalInstance.dismiss('ok');
	};
}
]
);

sanityApp.controller('UpdatesModalCtrl',
[
'$rootScope', '$scope', '$store', '$modal', 'ytApp',
function ($rootScope, $scope, $store, $modal, ytApp) {
	$scope.status = $rootScope.status;

	$scope.open = function () {
		var modalInstance = $modal.open({
			templateUrl: 'templates/updates.html',
			backdrop: false,
			dialogFade:true,
			controller: 'UpdatesModalInstanceCtrl',
			scope: $scope
		});
	};
}
]
);

sanityApp.controller('UpdatesModalInstanceCtrl',
[
'$rootScope', '$scope', '$store', '$modalInstance', 'ytApp',
function ($rootScope, $scope, $store, $modalInstance, ytApp) {
	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};
}
]
);

sanityApp.controller('SettingsTabsCtrl',
[
'$rootScope', '$scope',
function ($rootScope, $scope) {
	$scope.tabs = [];

	$scope.navType = 'pills';

	$scope.adblockadvice = 'firefox';

	$scope.adblockswitch = function( type ) {
		$scope.adblockadvice = type;
	};
}
]
);

sanityApp.controller('SettingsAccordionCtrl',
[
'$scope',
function ($scope) {
	$scope.oneAtATime = true;
}
]
);

sanityApp.service('appLoading',
[
'$rootScope',
function ( $rootScope )
{
	var timer;

	this.loading = function () {
		clearTimeout( timer );

		$rootScope.status = 1;
	};

	this.ready = function ( delay ) {
		function ready() {
			$rootScope.status = 0;
		}

		clearTimeout( timer );

		delay = delay === null ? 500 : false;

		if ( delay ) {
			timer = setTimeout( ready, delay );
		} else {
			ready();
		}
	};
}
]
);


sanityApp.service('ytData',
[
'$q', 'googleApi',
function ( $q, googleApi ) {
	var self = this;

	this.get = function ( type, options ) {
		var deferred = $q.defer();

		googleApi.gapi.client.setApiKey(googleApi.apiKey);

		var request = googleApi.gapi.client.youtube[type].list(options);

		request.execute(function(response) {
			deferred.resolve(response);
		});

		return deferred.promise;
	};

	this.subscriptions = function ( page ) {
		var options = {
			part: 'snippet',
			mine: true,
			maxResults: 50
		};

		if ( typeof page != 'undefined' ) {
			if ( page !== null ) {
				options.page = page;
			}
		}

		return self.get('subscriptions', options);
	};

	this.channels = function ( page ) {
		var options = {
			part: 'snippet',
			mine: true,
			maxResults: 50
		};

		if ( typeof page != 'undefined' ) {
			if ( page !== null ) {
				options.page = page;
			}
		}

		return self.get('channels', options);
	};

	this.channelvideos = function ( channel ) {
		return self.get(
			'activities',
			{
				part: 'contentDetails',
				channelId: channel,
				maxResults: 50
			}
		);
	};

	this.videos = function ( ids )
	{
		return self.get(
			'videos',
			{
				part: 'snippet,contentDetails,status,statistics',
				mine: true,
				id: ids.join()
			}
		);
	};
}
]
);

sanityApp.provider('googleApi', function GoogleApiProvider () {
	var self = this;

	this.clientId = '950592637430.apps.googleusercontent.com';

	this.apiKey = 'AIzaSyCvgbEI4Q6bkkRi6AI1zwiv5oWpZQw9Sxc';

	this.scopes = 'https://www.googleapis.com/auth/youtube';

	this.gapi = gapi;

	this.q = {};

	this.connect = function()
	{
		var deferred = self.q.defer();

		this.gapi.auth.authorize(
			{
			client_id: this.clientId,
			scope: this.scopes,
			immediate: false
			},
			function( result ) {
				if ( result && !result.error ) {
					self.gapi.client.load('youtube', 'v3', function(response) {
						deferred.resolve(response);
					});
				} else {
					deferred.reject();
				}
			}
		);

		return deferred.promise;
	};

	this.checkAuth = function() {
		return this.connect();
	};

	this.authorize = function() {
		return this.connect();
	};

	this.load = function() {
		this.gapi.load();

		this.gapi.client.setApiKey(this.apiKey);
	};

	this.$get = [
		'$q',
		function ( $q )
		{
			var provider = new GoogleApiProvider();

			provider.q = $q;

			return provider;
		}
	];

});



sanityApp.service('ytApp',
[
'$q', '$rootScope',
function ( $q, $rootScope ) {
	var versionHigher = function (v1, v2) {
		var v1parts = v1.split('.');
		var v2parts = v2.split('.');

		for (var i = 0; i < v1parts.length; ++i) {
			if (v1parts[i] > v2parts[i]) return true;
		}

		return false;
	};

	this.appinfo = function ( fn ) {
		var url = "/yt-sanegrid/info.json";

		var defer = $q.defer();

		$.getJSON( url )
			.fail( function ( j, t, e ) {
				fn( e, j.status );
			} )
			.done( function ( json ) {
				fn( json, 200 );
			} );
	};

	this.appupdates = function ( fn ) {
		var daviddeutsch = new Gh3.User("daviddeutsch");

		var sanegrid = new Gh3.Repository("yt-sanegrid", daviddeutsch);

		sanegrid.fetch(function (err, res) {
			if(err) { fn( err, 500 ); }
		});

		sanegrid.fetchClosedIssues(function (err, res) {
			if(err) { fn( err, 500 ); }

			fn( sanegrid.getIssues(), 200 );
		});
	};

	that = this;

	this.update = function() {
		that.appinfo( function( data, code ) {
			if ( !versionHigher( data.version, $rootScope.info.version ) ) {
				return;
			}

			$rootScope.info.update = data.version;
			$rootScope.info.updates.outdated = true;
			$rootScope.info.updates.new = 0;
			$rootScope.info.updates.title = "Fresh Update(s)!";

			that.appupdates( function( list, code ) {
				$rootScope.info.updates.list = list;

				$.each( $rootScope.info.updates.list, function ( i, v ) {
					var date = new Date( v.updated_at );

					if ( date > $rootScope.info.date ) {
						$rootScope.info.updates.list[i].new = true;

						$rootScope.info.updates.new++;
					} else {
						$rootScope.info.updates.list[i].new = false;
					}
				});
			});
		});
	};

	this.appinfo( function( data, code ) {
		$rootScope.info = {
			version: data.version,
			updates: {list: []},
			date: new Date()
		};

		that.appupdates( function( list, code ) {
			$rootScope.info.updates.list = list;
		});
	});
}
]
);

sanityApp.filter('duration',
function () {
	return function ( d ) {

		var duration = d.split('#');

		duration[1] = Number(duration[1]);
		duration[2] = Number(duration[2]);

		var h = Math.floor( duration[1] / 60 );
		var m = Math.floor( duration[1] % 60 );
		var s = duration[2];

		return (
			( h > 0 ? h + ":" : "" )
				+ ( m > 0 ? (h > 0 && m < 10 ? "0" : "" ) + m + ":" : "00:")
				+ (s < 10 ? "0" : "") + s
			);
	};
}
);

sanityApp.filter('timestamp',
function () {
	return function ( d ) {
		return new Date( d ).getTime();
	};
}
);

// From: http://jsfiddle.net/lrlopez/dFeuf/
sanityApp.service('timeAgoService',
function($timeout) {
	var ref;
	return {
		nowTime: 0,
		initted: false,
		settings: {
			refreshMillis: 60000,
			allowFuture: false,
			strings: {
				prefixAgo: null,
				prefixFromNow: null,
				suffixAgo: "ago",
				suffixFromNow: "from now",
				seconds: "less than a minute",
				minute: "about a minute",
				minutes: "%d minutes",
				hour: "about an hour",
				hours: "about %d hours",
				day: "a day",
				days: "%d days",
				month: "about a month",
				months: "%d months",
				year: "about a year",
				years: "%d years",
				numbers: []
			}
		},
		doTimeout: function() {
			ref.nowTime = (new Date()).getTime();
			$timeout(ref.doTimeout, ref.settings.refreshMillis);
		},
		init: function() {
			if (this.initted === false) {
				this.initted = true;
				this.nowTime = (new Date()).getTime();
				ref = this;
				this.doTimeout();
				this.initted = true;
			}
		},
		inWords: function(distanceMillis) {
			var $l = this.settings.strings;
			var prefix = $l.prefixAgo;
			var suffix = $l.suffixAgo;
			if (this.settings.allowFuture) {
				if (distanceMillis < 0) {
					prefix = $l.prefixFromNow;
					suffix = $l.suffixFromNow;
				}
			}

			var seconds = Math.abs(distanceMillis) / 1000;
			var minutes = seconds / 60;
			var hours = minutes / 60;
			var days = hours / 24;
			var years = days / 365;

			function substitute(stringOrFunction, number) {
				var string = $.isFunction(stringOrFunction) ? stringOrFunction(number, distanceMillis) : stringOrFunction;
				var value = ($l.numbers && $l.numbers[number]) || number;
				return string.replace(/%d/i, value);
			}

			var words = seconds < 45 && substitute($l.seconds, Math.round(seconds)) ||
				seconds < 90 && substitute($l.minute, 1) ||
				minutes < 45 && substitute($l.minutes, Math.round(minutes)) ||
				minutes < 90 && substitute($l.hour, 1) ||
				hours < 24 && substitute($l.hours, Math.round(hours)) ||
				hours < 42 && substitute($l.day, 1) ||
				days < 30 && substitute($l.days, Math.round(days)) ||
				days < 45 && substitute($l.month, 1) ||
				days < 365 && substitute($l.months, Math.round(days / 30)) ||
				years < 1.5 && substitute($l.year, 1) ||
				substitute($l.years, Math.round(years));

			var separator = $l.wordSeparator === undefined ?  " " : $l.wordSeparator;
			return $.trim([prefix, words, suffix].join(separator));
		}
	};
}
);

sanityApp.directive('timeAgo',
[
'timeAgoService',
function(timeago) {
	return {
		replace: true,
		restrict: 'EA',
		scope: {
			"fromTime":"@"
		},
		link: {
			post: function(scope, linkElement, attrs) {
				scope.timeago = timeago;
				scope.timeago.init();
				scope.$watch("timeago.nowTime-fromTime",function(value) {
					if (scope.timeago.nowTime !== undefined) {
						value = scope.timeago.nowTime-scope.fromTime;
						$(linkElement).text(scope.timeago.inWords(value));
					}
				});
			}
		}
	};
}
]
);

sanityApp.directive('selectOnClick',
function () {
	return function (scope, element, attrs) {
		element.bind('click', function () {
			this.select();
		});
	};
}
);

sanityApp.config(
	[
		'googleApiProvider',
		function( googleApiProvider ) {
			googleApiProvider.load();
		}
	]
);

function googleOnLoadCallback() {
	angular.bootstrap(document, ["sanityApp"]);
}
