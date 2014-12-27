(function () {

	angular.module('sanityApp', [
		'ngAnimate', 'ui.router', 'mgcrea.ngStrap', 'ngSocial',
		'localStorage', 'googleAPI', 'sanityData'
	]);


	/**
	 * @name AppCfg
	 *
	 * @desc Set up the Application
	 */
	function AppCfg( $urlRouterProvider, $stateProvider )
	{
		$urlRouterProvider
			.otherwise('/ready');

		$stateProvider
			.state('ready', {
				url: '/ready',
				views: {
					"main": {
						templateUrl: 'templates/start.html'
					}
				}
			})

			.state('list', {
				url: '/list',
				views: {
					"main": {
						templateUrl: 'templates/videos.html'
					},
					"footer": {
						templateUrl: 'templates/footer.html'
					}
				}
			})
		;
	}

	AppCfg.$inject = ['$urlRouterProvider', '$stateProvider'];
	angular.module('sanityApp').config(AppCfg);


	/**
	 * @name AppRun
	 *
	 * @desc Data to prepare when we run the application
	 */
	function AppRun( $rootScope )
	{
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
		}

		if ( typeof $rootScope.filters.global == 'undefined' ) {
			$rootScope.filters = {};
			$rootScope.filters.count = 0;
			$rootScope.filters.caught = 0;
			$rootScope.filters.global = [];
			$rootScope.filters.channels = {};
		}

		if ( typeof $rootScope.filters.channels == 'undefined' ) {
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

	AppRun.$inject = ['$rootScope'];
	angular.module('sanityApp').run(AppRun);


	/**
	 * @name StartCtrl
	 *
	 * @desc Controls Behavior on the home screen
	 */
	function StartCtrl( $scope, $rootScope, $state, googleApi )
	{
		$scope.gotimelist = [
			'YEAH BOIIIII!!!',
			'Well, if you say so, I guess...',
			'My body is ready for sanity!',
			'Let\'s go!',
			'Jeez, enough with the buttons already'
		];

		var rand = Math.floor((Math.random() * $scope.gotimelist.length));

		$scope.gotime = $scope.gotimelist[rand];

		$scope.startlinelist = [
			'It\'s substantially more pleasant than a good, hard slap in the face' ,
			'It almost certainly cannot give you, like, any tangible disease',
			'Just like your extensive YouTube habit, it\'s totally not at all an unlimited source of self-loathing for its author',
			'Nobody technically forces you to use it, which is cool, I guess'
		];

		rand = Math.floor((Math.random() * $scope.startlinelist.length));

		$scope.startline = $scope.startlinelist[rand];

		$scope.selectUserid = function ( q ) {
			if ( q === false ) {
				$state.go('ready');
			} else {
				$state.go('list');
			}
		};

		$scope.connect = function()
		{
			googleApi.authorize()
				.then(function(){
					$state.go('list');
				});
		};

		if ( $rootScope.userid ) {
			$scope.start = false;

			$rootScope.settings.sidebar = false;

			googleApi.checkAuth()
				.then(function(){
					$state.go('list');
				});
		}
	}

	StartCtrl.$inject = ['$scope', '$rootScope', '$state', 'googleApi'];
	angular.module('sanityApp').controller('StartCtrl', StartCtrl);


	function AppRepeatCtrl( $rootScope, $scope, $state, $document, sanityApp, data, videos )
	{
		if ( typeof $rootScope.userid == 'undefined' ) {
			$state.go('ready');
		}

		var initAccount = function () {
			$rootScope.settings.sidebar = false;

			sanityApp.loading();

			data.init()
				.then(function() {
					sanityApp.ready();

					videos.load($scope)
						.then(function(){
							$scope.videos = videos.list;

							$rootScope.$on('videos:updated', function(event, data) {
								$scope.videos = videos.list;
							});

							sanityApp.loading();

							data.update()
								.then(function(){
									sanityApp.ready();
								});
						});
				}, function(){
					$state.go('ready');
				});
		};

		var updateSidebar = function () {
			if ( $rootScope.settings.sidebar === true ) {
				$('.sidebar' ).css({"height":$document.height()});
			} else {
				$('.sidebar' ).css({"height":"40px"});
			}
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

			if ( $rootScope.channelstate.hidden[video.channelId] === "1" ) {
				return null;
			}

			var filtered = false;

			$.each( $rootScope.filters.global, function ( i, v ) {
				if ( video.title.indexOf( v.string ) != -1 ) {
					filtered = true;
				}
			});

			return video;
		};

		$scope.setLimit = function (increment) {
			$rootScope.settings.videolimit =
				Number($rootScope.settings.videolimit) + Number(increment)
			;

			if ( $rootScope.settings.videolimit < 1 ) {
				$rootScope.settings.videolimit = 5;
			}
		};

		$scope.percentage = 0;
		$scope.abslength = 100;

		/*var getPercentage = function () {
			if ( $rootScope.settings.videolimit < $scope.videos.length ) {
				$scope.percentage = parseInt(100 * $rootScope.settings.videolimit / $scope.videos.length);

				$scope.abslength = $rootScope.settings.videolimit;
			} else {
				$scope.percentage = 100;

				$scope.abslength = $scope.videos.length;
			}
		};

		$scope.$watch('videos', getPercentage, true);

		$scope.$watch('settings', getPercentage, true);

		$scope.percentage = getPercentage();*/

		initAccount();

		updateSidebar();
	}

	AppRepeatCtrl.$inject = ['$rootScope', '$scope', '$state', '$document', 'sanityApp', 'data', 'videos'];
	angular.module('sanityApp').controller('AppRepeatCtrl', AppRepeatCtrl);


	function FooterCtrl( $rootScope, $scope, $document, sanityApp, data, videos )
	{
		$scope.refresh = function() {
			sanityApp.loading();

			sanityApp.update();

			data.update()
				.then(function(){
					sanityApp.ready();
				});
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

		angular.element($document).bind("keyup", function(event) {
			if (event.which === 82) $scope.refresh();
		});
	}

	FooterCtrl.$inject = ['$rootScope', '$scope', '$document', 'sanityApp', 'data', 'videos'];
	angular.module('sanityApp').controller('FooterCtrl', FooterCtrl);


	function SettingsModalCtrl( $rootScope, $scope )
	{
		//$store.bind( $rootScope, 'filters', {} );

		$scope.cancel = function () {
			$scope.$hide();
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
				$rootScope.filters.global.splice(id, 1);
			}

			$rootScope.filters.count--;
		};
	}

	SettingsModalCtrl.$inject = ['$rootScope', '$scope'];
	angular.module('sanityApp').controller('SettingsModalCtrl', SettingsModalCtrl);


	function FilterModalCtrl( $rootScope, $scope )
	{
		if ( $scope.video.authorid ) {
			$scope.filter = {
				title: $scope.video.title,
				channel: $scope.video.authorid,
				author: $scope.video.author,
				authorid: $scope.video.authorid
			};
		} else {
			$scope.filter = {
				title: $scope.video.title,
				channel: $scope.video.author,
				author: $scope.video.author,
				authorid: $scope.video.author
			};
		}


		$scope.cancel = function () {
			$scope.$hide();
		};

		$scope.ok = function () {
			//$store.bind( $rootScope, 'filters', {} );

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

			$scope.$hide();
		};
	}

	FilterModalCtrl.$inject = ['$rootScope', '$scope'];
	angular.module('sanityApp').controller('FilterModalCtrl', FilterModalCtrl);


	function SettingsTabsCtrl( $scope )
	{
		$scope.tabs = [];

		$scope.navType = 'pills';

		$scope.adblockadvice = 'firefox';

		$scope.adblockswitch = function( type ) {
			$scope.adblockadvice = type;
		};
	}

	SettingsTabsCtrl.$inject = ['$scope'];
	angular.module('sanityApp').controller('SettingsTabsCtrl', SettingsTabsCtrl);


	function SettingsAccordionCtrl( $scope )
	{
		$scope.oneAtATime = true;
	}

	SettingsAccordionCtrl.$inject = ['$scope'];
	angular.module('sanityApp').controller('SettingsAccordionCtrl', SettingsAccordionCtrl);

	/**
	 * @name sanityApp
	 *
	 * @desc Central App functionality
	 */
	function sanityAppService( $q, $rootScope )
	{
		var versionHigher = function (v1, v2) {
			var v1parts = v1.split('.');
			var v2parts = v2.split('.');

			for (var i = 0; i < v1parts.length; ++i) {
				if (v1parts[i] > v2parts[i]) return true;
			}

			return false;
		};

		var timer;

		this.resetErrors = function () {
			if ( $rootScope.forbidden == 1 || $rootScope.notfound == 1 ) {
				$rootScope.forbidden = 0;
				$rootScope.notfound = 0;
			}
		};

		this.appinfo = function ( fn ) {
			var url = "info.json";

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

	sanityAppService.$inject = ['$q', '$rootScope'];
	angular.module('sanityApp').service('sanityApp', sanityAppService);


	/**
	 * @name timeAgoService
	 *
	 * @desc put a time distance into words
	 *
	 * From: http://jsfiddle.net/lrlopez/dFeuf/
	 */
	function timeAgoService($timeout) {
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

	timeAgoService.$inject = ['$timeout'];
	angular.module('sanityApp').service('timeAgo', timeAgoService);


	/**
	 * @name durationFilter
	 *
	 * @desc Turn a YT duration stamp into a parsed number
	 */
	function durationFilter()
	{
		return function ( d ) {

			var duration = d.split('M'); // PT35M2S

			duration[0] = Number(duration[0].slice(2));

			if ( typeof duration[1] == 'undefined' ) {
				duration[1] = 0;
			} else {
				duration[1] = Number(duration[1].slice(0,-1));
			}

			var h = Math.floor( duration[0] / 60 );
			var m = Math.floor( duration[0] % 60 );
			var s = duration[1];

			return (
				( h > 0 ? h + ":" : "" )
					+ ( m > 0 ? (h > 0 && m < 10 ? "0" : "" ) + m + ":" : "00:")
					+ (s < 10 ? "0" : "") + s
				);
		};
	}

	angular.module('sanityApp').filter('duration', durationFilter);


	/**
	 * @name timestampFilter
	 *
	 * @desc convert a Date() object into a timestamp string
	 */
	function timestampFilter()
	{
		return function ( d ) {
			return new Date( d ).getTime();
		};
	}

	angular.module('sanityApp').filter('timestamp', timestampFilter);


	/**
	 * @name videoItemDirective
	 *
	 * @desc Control behavior in video item
	 */
	function videoItemDirective( $timeout, videos )
	{
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

					videos.data.update($scope.video);
				};

				$scope.watch = function( $event ) {
					if ( ($event.button == 2) ) {
						return;
					}

					$timeout(function(){$scope.watched(false);}, 400);
				};
				$scope.watched = function ( force ) {
					if ( $scope.video.watched && !force ) {
						return;
					}

					$scope.video.watched = !$scope.video.watched;
					$scope.video.watcheddate = new Date().toISOString();

					videos.data.update($scope.video);
				};

				if ( $rootScope.settings.adblockoverride ) {
					$scope.link = $scope.video.link+"&adblock="+$rootScope.settings.adblocksecret;
				} else {
					$scope.link = $scope.video.link;
				}

			}
		}
	}

	videoItemDirective.$inject = ['$timeout', 'videos'];
	angular.module('sanityApp').directive('videoItem', videoItemDirective);


	/**
	 * @name timeAgoDirective
	 *
	 * @desc Use the timeago service to show when something has been posted
	 */
	function timeAgoDirective( timeAgo )
	{
		return {
			replace: true,
			restrict: 'EA',
			scope: {
				"fromTime":"@"
			},
			link: {
				post: function(scope, linkElement, attrs) {
					scope.timeago = timeAgo;
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

	timeAgoDirective.$inject = ['timeAgo'];
	angular.module('sanityApp').directive('timeAgo', timeAgoDirective);

	/**
	 * @name selectOnClickDirective
	 *
	 * @desc Select an item on being clicked
	 */
	function selectOnClickDirective() {
		return function (scope, element, attrs) {
			element.bind('click', function () {
				this.select();
			});
		};
	}

	angular.module('sanityApp').directive('selectOnClick', selectOnClickDirective);

})();

/**
 * @name googleOnLoadCallback
 *
 * @desc Bootstrap our Angular App once the google API has loaded
 */
function googleOnLoadCallback() {
	angular.bootstrap(document, ["sanityApp"]);
}
