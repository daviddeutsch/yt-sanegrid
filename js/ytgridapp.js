var ytsubgridApp = angular.module( "ytsubgridApp", ['ngAnimate', 'ui.bootstrap', 'ngSocial', 'localStorage'] );

ytsubgridApp.controller( 'AppCtrl',
	['$rootScope', 'appLoading',
	function ( $rootScope, appLoading ) {
		$rootScope.topScope = $rootScope;

		$rootScope.$on( '$routeChangeStart', function () {
			appLoading.loading();
		} );
	}]
);

ytsubgridApp.controller( 'AppRepeatCtrl',
	['$rootScope', '$scope', '$store', '$document', 'ytApp', 'ytData', 'appLoading', 'Videolist',
	function ( $rootScope, $scope, $store, $document, ytApp, ytData, appLoading, Videolist ) {

		$scope.start = true;

		$store.bind( $rootScope, 'userid', '' );
		$store.bind( $rootScope, 'videocache', {} );
		$store.bind( $rootScope, 'videos', [] );
		$store.bind( $rootScope, 'settings', {} );
		$store.bind( $rootScope, 'channelstate', {} );
		$store.bind( $rootScope, 'filters', {} );

		if ( $.isEmptyObject( $rootScope.settings ) ) {
			$rootScope.settings = {
				hidewatched: false,
				hidemuted:   true,
				theme:       'default'
			}
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



		var datesort = function ( a, b ) {
			var datea = new Date( a.published );
			var dateb = new Date( b.published );

			if ( datea < dateb )
				return 1;
			if ( datea > dateb )
				return -1;
			return 0;
		};

		var checkData = function () {
			// Retrofit some parameters to existing data
			$.each( $rootScope.videos, function ( i, v ) {
				if ( typeof $rootScope.videos[i].watched == 'undefined' ) {
					$rootScope.videos[i].watched = $rootScope.videos[i].muted;
					$rootScope.videos[i].muted = false;
				}
			} );
		};

		var setUserid = function ( u ) {
			$scope.start = false;
			$rootScope.settings.sidebar = false;

			if ( typeof $rootScope.videocache[u] == 'undefined' ) {
				$rootScope.videocache[u] = [];
			}

			$rootScope.userid = u;

			$rootScope.videos = $rootScope.videocache[u];

			ytData.channels( $rootScope.userid, loadChannels );
		};

		var loadChannels = function ( data, code ) {
			if ( code == 200 ) {
				if ( typeof data != 'undefined' ) {
					$scope.channels = [];

					var idents = [];

					$.each( data, function ( i, v ) {
						if ( $.inArray( v['yt$username'], idents ) == -1 ) {
							$scope.channels.push(
								{
									id: v['yt$channelId']['$t'],
									name: v['yt$username']['$t'],
									thumbnail: v['media$thumbnail']['url']
								}
							);

							idents.push( v['yt$username'] );
						}
					} );
				}
			} else if ( code == 403 ) {
				$scope.forbidden = 1;
			} else {
				$scope.notfound = 1;
			}

			appLoading.ready( 100 );
		};

		var pushVideos = function ( data, code ) {
			if ( code == 200 ) {
				if ( typeof data != 'undefined' ) {
					for ( var i = 0; i < data.length; i++ ) {
						pushVideo( data[i] );
					}

					$rootScope.videos.sort( datesort );

					checkData();
				}
			} else if ( code == 403 ) {
				$scope.start = true;
				$scope.forbidden = 1;
			} else {
				$scope.start = true;
				$scope.notfound = 1;
			}

			appLoading.ready( 100 );
		};

		var pushVideo = function ( o ) {
			var id = o['id']['$t']
				.replace( 'https://gdata.youtube.com/feeds/api/videos/', '' )
				.replace( 'http://gdata.youtube.com/feeds/api/videos/', '' );

			var authid = o['author'][0]['uri']['$t']
				.replace( 'https://gdata.youtube.com/feeds/api/users/', '' );

			var details = {
				id:          id,
				link:        'https://www.youtube.com/watch?v=' + id,
				title:       o['title']['$t'],
				img:         o['media$group']['media$thumbnail'][0]['url'],
				authorid:    authid,
				author:      o['author'][0]['name']['$t'],
				authorlink:  'https://www.youtube.com/user/' + authid,
				published:   o['published']['$t'],
				duration:    o['media$group']['yt$duration']['seconds'],
				muted:       false,
				muteddate:   null,
				watched:     false,
				watcheddate: null
			};

			var existing = false;

			var eid = 0;

			$.each( $rootScope.videos, function ( i, v ) {
				if ( $rootScope.videos[i].id == id ) {
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
						$rootScope.videos[eid][v] = details[v];
					}
				);
			} else {
				$rootScope.videos.push( details );
			}

			return true;
		};

		var resetErrors = function () {
			if ( $scope.forbidden == 1 || $scope.notfound == 1 ) {
				appLoading.loading();

				$scope.forbidden = 0;
				$scope.notfound = 0;

				appLoading.ready( 100 );
			}
		};

		var loadTop = function () {
			resetErrors();

			appLoading.loading();

			$rootScope.filters.caught = 0;

			ytData.subscriptionvideos( $rootScope.userid, 1, pushVideos );

			appLoading.ready( 100 );
		};

		var updateSidebar = function () {
			if ( $rootScope.settings.sidebar === true ) {
				$('.sidebar' ).css({"height":$document.height()});
			} else {
				$('.sidebar' ).css({"height":"40px"});
			}
		};

		$scope.loadBottom = function () {
			if ( $scope.start ) return;

			if ( $rootScope.videos.length > 50 ) return;

			resetErrors();

			appLoading.loading();

			$rootScope.filters.caught = 0;

			ytData.subscriptionvideos( $rootScope.userid, $rootScope.videos.length + 1, pushVideos );
		};

		$scope.selectUserid = function ( q ) {
			if ( q == false ) {
				$scope.start = true;
			} else {
				setUserid( q );

				loadTop();
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

		$scope.videolist = Videolist.getVideos();

		angular.element($document).bind("keyup", function(event) {
			if (event.which === 82) $scope.refresh();
		});

		if ( $rootScope.userid ) {
			$scope.start = false;
			$rootScope.settings.sidebar = false;

			setUserid( $rootScope.userid );

			loadTop();

			updateSidebar();
		}
	}]
);

ytsubgridApp.factory( 'Videolist',
	['$rootScope', '$store',
		function ( $rootScope, $store ) {
			return {
				getVideos: function() {
					return function() {
						var ids = [];
						var list = [];

						var len = $rootScope.videos.length;

						for( i=0; i<len; i++ ) {
							var video = $rootScope.videos[i];

							if ( $.inArray( video.id, ids ) != -1  ) {
								$rootScope.videos.splice(i, 1);

								list[i] = null;
								continue;
							}

							if (
								( ( video.muted && ($rootScope.settings.hidemuted == "1") )
									|| ( video.watched && ($rootScope.settings.hidewatched == "1") ) )
								) {
								continue;
							}

							var auth = video.authorlink.split("/");
							var key = auth[auth.length-1].toLowerCase();

							if ( $rootScope.channelstate.hidden[key] === "1" ) {
								continue;
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

								$rootScope.videos[i].muted = true;

								continue;
							}

							ids.push(video.id);

							list[i] = video;
						}

						return list;
					}
				}
			};
		}]
);

ytsubgridApp.directive('videoItem', function() {
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

				$scope.watched(false);
			};

			$scope.link = function () {
				if ( $rootScope.settings.adblockoverride ) {
					return $scope.video.link+"&adblock="+$rootScope.settings.adblocksecret;
				} else {
					return $scope.video.link;
				}

			};

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

ytsubgridApp.controller( 'SettingsModalCtrl',
	[ '$scope', '$store', '$modal',
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
		}]
);

ytsubgridApp.controller( 'SettingsModalInstanceCtrl',
	[ '$rootScope', '$scope', '$store', '$modalInstance',
		function ($rootScope, $scope, $store, $modalInstance) {
			$store.bind( $rootScope, 'filters', {} );

			$scope.cancel = function () {
				$modalInstance.dismiss('cancel');
			};

			$scope.redoadblocksecret = function () {
				$rootScope.settings.adblocksecret = Math.random().toString(36).substr(2);
			}

			$scope.removeFilter = function (channel, id) {
				if ( channel.length ) {
					$rootScope.filters.channels[channel].filters.splice(id,1);

					if ( $rootScope.filters.channels[channel].filters.length == 0 ) {
						delete $rootScope.filters.channels[channel];
					}
				} else {
					$rootScope.filters.global.splice(id,1)
				}

				$rootScope.filters.count--;
			};
		}]
);

ytsubgridApp.controller( 'SupportModalCtrl',
	[ '$scope', '$modal',
	function ($scope, $modal) {
		$scope.open = function () {
			var modalInstance = $modal.open({
				templateUrl: 'templates/support.html',
				backdrop: false,
				dialogFade:true,
				controller: 'SupportModalInstanceCtrl'
			});
		};
	}]
);

ytsubgridApp.controller( 'SupportModalInstanceCtrl',
	['$scope', '$modalInstance',
		function ($scope, $modalInstance) {
			$scope.cancel = function () {
				$modalInstance.dismiss('cancel');
			};
		}]
);

ytsubgridApp.controller( 'FilterModalCtrl',
	[ '$scope', '$store', '$modal',
		function ($scope, $store, $modal) {
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
		}]
);

ytsubgridApp.controller( 'FilterModalInstanceCtrl',
	[ '$rootScope', '$scope', '$store', '$modalInstance', 'item',
		function ($rootScope, $scope, $store, $modalInstance, item) {

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
		}]
);

ytsubgridApp.controller( 'UpdatesModalCtrl',
	[ '$rootScope', '$scope', '$store', '$modal', 'ytApp',
		function ($rootScope, $scope, $store, $modal, ytApp) {
			$scope.open = function () {
				var modalInstance = $modal.open({
					templateUrl: 'templates/updates.html',
					backdrop: false,
					dialogFade:true,
					controller: 'UpdatesModalInstanceCtrl',
					scope: $scope
				});
			};
		}]
);

ytsubgridApp.controller( 'UpdatesModalInstanceCtrl',
	[ '$rootScope', '$scope', '$store', '$modalInstance', 'ytApp',
		function ($rootScope, $scope, $store, $modalInstance, ytApp) {
			$scope.cancel = function () {
				$modalInstance.dismiss('cancel');
			};
		}]
);

ytsubgridApp.controller( 'SettingsTabsCtrl',
	[ '$rootScope', '$scope',
		function ($rootScope, $scope) {
			$scope.tabs = [];

			$scope.navType = 'pills';

			$scope.adblockadvice = 'firefox';

			$scope.adblockswitch = function( type ) {
				$scope.adblockadvice = type;
			};
		}]
);

ytsubgridApp.controller( 'SettingsAccordionCtrl',
	[ '$scope',
		function ($scope) {
			$scope.oneAtATime = true;
		}]
);

ytsubgridApp.factory( 'appLoading',
	['$rootScope',
	function ( $rootScope ) {
		var timer;
		return {
			loading: function () {
				clearTimeout( timer );

				$rootScope.status = 1;

				if ( !$rootScope.$$phase ) $rootScope.$apply();
			},
			ready:   function ( delay ) {
				function ready() {
					$rootScope.status = 0;

					if ( !$rootScope.$$phase ) $rootScope.$apply();
				}

				clearTimeout( timer );

				delay = delay == null ? 500 : false;

				if ( delay ) {
					timer = setTimeout( ready, delay );
				} else {
					ready();
				}
			}
		};
	}]
);

ytsubgridApp.factory( 'ytData',
	['$q', '$rootScope', '$store',
		function ( $q, $rootScope, $store ) {
			return {
				subscriptionvideos: function ( q, s, fn ) {
					var searchToken = '{SEARCH}';

					var startToken = '{START}';

					var baseUrl = "https://gdata.youtube.com/feeds/api/users/"
						+ searchToken
						+ "/newsubscriptionvideos?alt=json&start-index="
						+ startToken
						+ "&max-results=50"
						+ "&key=AIzaSyBx53eovwXsAoIp_KhsiGpHAG4bKFFGfTM";

					var defer = $q.defer();

					var url = baseUrl.replace( searchToken, q ).replace( startToken, s );

					$.getJSON( url )
						.fail( function ( j, t, e ) {
							fn( e, j.status );
						} )
						.done( function ( json ) {
							fn( json.feed.entry, 200 );
						} );
				},
				channels: function ( q, fn ) {
					var searchToken = '{SEARCH}';

					var baseUrl = "https://gdata.youtube.com/feeds/api/users/"
						+ searchToken
						+ "/subscriptions?alt=json"
						+ "&max-results=50"
						+ "&key=AIzaSyBx53eovwXsAoIp_KhsiGpHAG4bKFFGfTM";
					var defer = $q.defer();

					var url = baseUrl.replace( searchToken, q );

					$.getJSON( url )
						.fail( function ( j, t, e ) {
							fn( e, j.status );
						} )
						.done( function ( json ) {
							fn( json.feed.entry, 200 );
						} );
				},
				channelvideos: function ( q, fn ) {
					var searchToken = '{SEARCH}';

					var baseUrl = "https://gdata.youtube.com/feeds/api/users/"
						+ searchToken
						+ "/uploads?alt=json"
						+ "&key=AIzaSyBx53eovwXsAoIp_KhsiGpHAG4bKFFGfTM";
					var defer = $q.defer();

					var url = baseUrl.replace( searchToken, q );

					$.getJSON( url )
						.fail( function ( j, t, e ) {
							fn( e, j.status );
						} )
						.done( function ( json ) {
							fn( json.feed.entry, 200 );
						} );
				}
			};
		}]
);

ytsubgridApp.service( 'ytApp',
	['$q', '$rootScope',
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
				})
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

		}]
);

ytsubgridApp.directive( 'scroll',
	['$window', '$document',
	function ( $window, $document ) {
		return function ( scope, elem, attrs ) {
			angular.element( $window ).bind( 'scroll', function () {
				if ( $document.height() <= $window.innerHeight + $window.pageYOffset ) {
					scope.$apply( attrs.scroll );
				}
			} );
		};
	}]
);

ytsubgridApp.filter( 'duration',
	function () {
		return function ( d ) {
			d = Number( d );

			var h = Math.floor( d / 3600 );
			var m = Math.floor( d % 3600 / 60 );
			var s = Math.floor( d % 3600 % 60 );

			return (
				( h > 0 ? h + ":" : "" )
					+ ( m > 0 ? (h > 0 && m < 10 ? "0" : "" ) + m + ":" : "00:")
					+ (s < 10 ? "0" : "") + s
				);
		};
	}
);

ytsubgridApp.filter( 'timestamp',
	function () {
		return function ( d ) {
			return new Date( d ).getTime();
		};
	}
);

// From: http://jsfiddle.net/lrlopez/dFeuf/
ytsubgridApp.service('timeAgoService', function($timeout) {
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
			if (this.initted == false) {
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
	}
});

ytsubgridApp.directive('timeAgo',
	['timeAgoService',
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
							if (scope.timeago.nowTime != undefined) {
								value = scope.timeago.nowTime-scope.fromTime;
								$(linkElement).text(scope.timeago.inWords(value));
							}
						});
					}
				}
			}
		}
	]
);

ytsubgridApp.directive('selectOnClick', function () {
	return function (scope, element, attrs) {
		element.bind('click', function () {
			this.select();
		});
	};
});
